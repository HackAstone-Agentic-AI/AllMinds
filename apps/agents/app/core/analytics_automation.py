import os
import re
import statistics
from datetime import datetime
from typing import Any
from app.core.language import resolve_language_code, SA_LANGUAGES


def _safe_label(name: str) -> str:
    """Strip control characters and Unicode line terminators before embedding in text or LLM prompts."""
    return re.sub(r"[\r\n\t\x00-\x1f\x7f\x85  ]", " ", name).strip()[:80] or "this learner"

MIN_RECORDS_FOR_TREND = 3


def is_analytics_request(user_input: str, records: list | None = None) -> bool:
    text = user_input.strip().lower()
    if records:
        return True

    if not text:
        return False

    phrases = [
        "analytics",
        "analyse",
        "analyze",
        "graph",
        "chart",
        "progress",
        "trend",
        "trends",
        "incident log",
        "attendance",
        "iep goal",
        "behaviour frequency",
        "behavior frequency",
        "meltdown",
        "sensory trigger",
        "student data",
        "report",
    ]
    return any(phrase in text for phrase in phrases)


def safe_float(value, default=0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def parse_date(value: str) -> datetime | None:
    try:
        return datetime.fromisoformat(value)
    except Exception:
        return None


def calculate_trend(values: list[float]) -> str:
    if len(values) < 2:
        return "stable"
    diff = values[-1] - values[0]
    if diff > 5:
        return "improving"
    if diff < -5:
        return "declining"
    return "stable"


def normalize_behavior_score(behavior: dict[str, Any]) -> float:
    if not behavior:
        return 0.0

    keys = [
        "attention",
        "participation",
        "homework_completion",
        "emotional_regulation",
        "attendance",
    ]

    scores = [safe_float(behavior.get(key, 0)) for key in keys]
    valid_scores = [score for score in scores if score > 0]
    if not valid_scores:
        return 0.0

    avg = sum(valid_scores) / len(valid_scores)
    return round((avg / 5.0) * 100, 2)


def weighted_progress_score(mark_score: float, behavior_score: float) -> float:
    return round((0.7 * mark_score) + (0.3 * behavior_score), 2)


def subject_breakdown(cleaned: list[dict[str, Any]]) -> list[dict[str, Any]]:
    subjects: dict[str, list[float]] = {}
    for row in cleaned:
        # Fall back to the progress score when a record has no mark for that subject.
        value = row["mark"] if row["mark"] is not None else row["progress_score"]
        subjects.setdefault(row["subject"], []).append(value)
    return sorted(
        [
            {"subject": subject, "average_mark": round(statistics.mean(marks), 2)}
            for subject, marks in subjects.items()
        ],
        key=lambda item: item["subject"],
    )


def generate_narrative(learner_name: str, summary: dict, risk_flags: list[str], breakdown: list[dict]) -> str:
    learner_name = _safe_label(learner_name)
    strongest_subject = max(breakdown, key=lambda item: item["average_mark"], default=None)
    weakest_subject = min(breakdown, key=lambda item: item["average_mark"], default=None)

    sentences = [
        (
            f"{learner_name} is showing {'an' if summary['overall_trend'][0] in 'aeiou' else 'a'} "
            f"{summary['overall_trend']} overall pattern, "
            f"with an average progress score of {summary['average_progress']}%."
        )
    ]

    if strongest_subject:
        sentences.append(
            f"A clear strength is {strongest_subject['subject']}, averaging {strongest_subject['average_mark']}%."
        )

    if weakest_subject and weakest_subject != strongest_subject:
        sentences.append(
            f"The area needing the most support right now is {weakest_subject['subject']} at {weakest_subject['average_mark']}%."
        )

    if summary["behavior_trend"] == "improving":
        sentences.append("Behaviour and regulation indicators are improving, which may support stronger academic consistency.")
    elif summary["behavior_trend"] == "declining":
        sentences.append("Behaviour and regulation indicators are dipping, so a review of support routines would be helpful.")

    if risk_flags:
        sentences.append("Priority support areas: " + "; ".join(risk_flags) + ".")
    else:
        sentences.append("No immediate risk flags were identified from the current record set.")

    sentences.append("A sensible next step is to keep tracking the same measures weekly and adjust support in the lowest-performing area first.")
    return " ".join(sentences[:5])


def _translate_analytics_text(text: str, language_pref: str) -> str:
    """Translate short analytics output text to the target SA language using Gemini."""
    code = resolve_language_code(language_pref)
    if code == "en":
        return text
    meta = SA_LANGUAGES.get(code, SA_LANGUAGES["en"])
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.messages import SystemMessage, HumanMessage
        from app.core.models import STANDARD_MODEL
        gemini_api_key = os.getenv("GEMINI_API_KEY")
        if not gemini_api_key:
            return text
        llm = ChatGoogleGenerativeAI(
            model=STANDARD_MODEL,
            api_key=gemini_api_key,
            temperature=0,
            max_tokens=600,
        )
        response = llm.invoke([
            SystemMessage(content=(
                f"Translate the following educational progress summary into {meta['native_name']} ({meta['english_name']}). "
                "Keep numbers, percentages, and proper nouns unchanged. "
                "Return only the translated text, nothing else."
            )),
            HumanMessage(content=text),
        ])
        return response.content.strip()
    except Exception:
        return text


def run_analytics_automation(user_input: str, learner_name: str = "", records: list | None = None, language_pref: str = "en") -> dict:
    learner = _safe_label(learner_name) if learner_name else "Learner"
    rows = records or []

    if not rows:
        return {
            "output": "No learner records were provided for analysis.",
            "narrative": "",
            "analytics": {},
            "risk_flags": [],
            "status": "no_input",
        }

    cleaned = []
    for row in rows:
        # A missing mark is "not assessed", not zero, so it must not drag averages down.
        has_mark = row.get("mark") not in (None, "")
        mark = safe_float(row.get("mark")) if has_mark else None
        behavior_score = normalize_behavior_score(row.get("behavior", {}))
        progress_score = (
            weighted_progress_score(mark, behavior_score) if mark is not None else behavior_score
        )
        cleaned.append(
            {
                "date": row.get("date", ""),
                "date_obj": parse_date(row.get("date", "")),
                "subject": row.get("subject", "General"),
                "mark": round(mark, 2) if mark is not None else None,
                "behavior_score": behavior_score,
                "progress_score": progress_score,
            }
        )

    cleaned.sort(key=lambda item: (item["date_obj"] is None, item["date_obj"] or datetime.min))

    marks = [item["mark"] for item in cleaned if item["mark"] is not None]
    behavior_scores = [item["behavior_score"] for item in cleaned]
    progress_scores = [item["progress_score"] for item in cleaned]

    summary = {
        "records": len(cleaned),
        "average_mark": round(statistics.mean(marks), 2) if marks else None,
        "average_behavior": round(statistics.mean(behavior_scores), 2),
        "average_progress": round(statistics.mean(progress_scores), 2),
        "mark_trend": calculate_trend(marks),
        "behavior_trend": calculate_trend(behavior_scores),
        "overall_trend": calculate_trend(progress_scores),
    }

    risk_flags = []
    if summary["average_mark"] is not None and summary["average_mark"] < 50:
        risk_flags.append("Academic performance needs additional support")
    if summary["average_behavior"] < 50:
        risk_flags.append("Behaviour/regulation support recommended")
    if summary["overall_trend"] == "declining":
        risk_flags.append("Overall progress is declining - early intervention advised")

    charts = {
        "line_progress_over_time": [
            {
                "date": item["date"],
                "mark": item["mark"],
                "behavior_score": item["behavior_score"],
                "progress_score": item["progress_score"],
                "subject": item["subject"],
            }
            for item in cleaned
        ],
        "bar_subject_average_marks": subject_breakdown(cleaned),
    }

    breakdown = subject_breakdown(cleaned)
    narrative = generate_narrative(learner, summary, risk_flags, breakdown)

    mark_text = (
        f"{learner}'s average mark is {summary['average_mark']}%"
        if summary["average_mark"] is not None else f"No marks were recorded for {learner}"
    )
    output = (
        f"{mark_text}; "
        f"behaviour score is {summary['average_behavior']}%, "
        f"overall progress score is {summary['average_progress']}%. "
        f"Mark trend: {summary['mark_trend']}. "
        f"Behaviour trend: {summary['behavior_trend']}. "
        f"Overall trend: {summary['overall_trend']}."
    )
    if risk_flags:
        output += " Risk flags: " + "; ".join(risk_flags) + "."
    if len(cleaned) < MIN_RECORDS_FOR_TREND:
        output += (
            f" Only {len(cleaned)} record(s) so far: trends need at least "
            f"{MIN_RECORDS_FOR_TREND} records to be reliable."
        )

    output = _translate_analytics_text(output, language_pref)
    narrative = _translate_analytics_text(narrative, language_pref)

    return {
        "output": output,
        "narrative": narrative,
        "analytics": {
            "summary": summary,
            "risk_flags": risk_flags,
            "charts": charts,
            "narrative": narrative,
        },
        "risk_flags": risk_flags,
        "status": "ok",
        "topic": user_input,
    }
