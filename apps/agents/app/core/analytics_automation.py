import os
import statistics
import textwrap
from datetime import datetime
from typing import Any

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
except ImportError:
    matplotlib = None
    plt = None
    mpatches = None

PALETTE = {
    "mark": "#4A90D9",
    "behavior": "#F5A623",
    "progress": "#7ED321",
    "bar": "#5B8DB8",
    "risk": "#E8834A",
    "bg": "#F9F7F4",
    "text": "#2C2C2C",
    "grid": "#E0DDD8",
}


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
        subjects.setdefault(row["subject"], []).append(row["mark"])
    return sorted(
        [
            {"subject": subject, "average_mark": round(statistics.mean(marks), 2)}
            for subject, marks in subjects.items()
        ],
        key=lambda item: item["subject"],
    )


def build_charts(learner_name: str, cleaned: list[dict], summary: dict, risk_flags: list[str]) -> dict[str, str]:
    if matplotlib is None or plt is None or mpatches is None:
        return {}

    output_dir = "charts"
    os.makedirs(output_dir, exist_ok=True)
    chart_paths = {}

    dates = [row["date"] for row in cleaned]
    x = range(len(dates))

    fig1, ax1 = plt.subplots(figsize=(10, 5), facecolor=PALETTE["bg"])
    ax1.set_facecolor(PALETTE["bg"])
    ax1.grid(color=PALETTE["grid"], linestyle="--", linewidth=0.7, zorder=0)

    ax1.plot(
        x,
        [row["mark"] for row in cleaned],
        color=PALETTE["mark"],
        marker="o",
        linewidth=2,
        label="Academic Mark (%)",
        zorder=3,
    )
    ax1.plot(
        x,
        [row["behavior_score"] for row in cleaned],
        color=PALETTE["behavior"],
        marker="s",
        linewidth=2,
        label="Behaviour Score (%)",
        zorder=3,
    )
    ax1.plot(
        x,
        [row["progress_score"] for row in cleaned],
        color=PALETTE["progress"],
        marker="^",
        linewidth=2,
        label="Overall Progress (%)",
        zorder=3,
    )

    ax1.set_xticks(list(x))
    ax1.set_xticklabels(dates, rotation=35, ha="right", fontsize=9, color=PALETTE["text"])
    ax1.set_yticks(range(0, 101, 10))
    ax1.set_ylim(0, 110)
    ax1.set_ylabel("Score (%)", color=PALETTE["text"], fontsize=10)
    ax1.set_xlabel("Session Date", color=PALETTE["text"], fontsize=10)
    ax1.tick_params(colors=PALETTE["text"])
    for spine in ax1.spines.values():
        spine.set_edgecolor(PALETTE["grid"])

    title1 = textwrap.fill(f"{learner_name} - Progress Over Time", width=55)
    ax1.set_title(title1, color=PALETTE["text"], fontsize=13, fontweight="bold", pad=12)
    ax1.legend(loc="lower right", framealpha=0.85, fontsize=9)

    trend_color = {
        "improving": PALETTE["progress"],
        "declining": PALETTE["risk"],
        "stable": PALETTE["behavior"],
    }[summary["overall_trend"]]
    ax1.annotate(
        f"Overall trend: {summary['overall_trend'].upper()}",
        xy=(0.01, 0.96),
        xycoords="axes fraction",
        fontsize=9,
        color=trend_color,
        fontweight="bold",
    )

    fig1.tight_layout()
    path1 = os.path.join(output_dir, f"{learner_name.replace(' ', '_')}_progress_over_time.png")
    fig1.savefig(path1, dpi=150, bbox_inches="tight")
    plt.close(fig1)
    chart_paths["line_progress_over_time"] = path1

    breakdown = subject_breakdown(cleaned)
    subjects = [item["subject"] for item in breakdown]
    averages = [item["average_mark"] for item in breakdown]

    fig2, ax2 = plt.subplots(figsize=(max(6, len(subjects) * 1.4), 5), facecolor=PALETTE["bg"])
    ax2.set_facecolor(PALETTE["bg"])
    ax2.grid(axis="y", color=PALETTE["grid"], linestyle="--", linewidth=0.7, zorder=0)

    bars = ax2.bar(
        subjects,
        averages,
        color=PALETTE["bar"],
        edgecolor="white",
        linewidth=0.8,
        zorder=3,
        width=0.55,
    )

    for bar, value in zip(bars, averages):
        ax2.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + 1.5,
            f"{value:.1f}%",
            ha="center",
            va="bottom",
            fontsize=9,
            color=PALETTE["text"],
            fontweight="bold",
        )

    ax2.axhline(50, color=PALETTE["risk"], linestyle=":", linewidth=1.5, zorder=2)
    ax2.annotate("Support threshold (50%)", xy=(len(subjects) - 0.5, 51.5), fontsize=8, color=PALETTE["risk"], ha="right")

    ax2.set_ylim(0, 110)
    ax2.set_ylabel("Average Mark (%)", color=PALETTE["text"], fontsize=10)
    ax2.set_xlabel("Subject", color=PALETTE["text"], fontsize=10)
    ax2.tick_params(colors=PALETTE["text"])
    for spine in ax2.spines.values():
        spine.set_edgecolor(PALETTE["grid"])

    title2 = textwrap.fill(f"{learner_name} - Average Mark by Subject", width=55)
    ax2.set_title(title2, color=PALETTE["text"], fontsize=13, fontweight="bold", pad=12)

    if risk_flags:
        patch = mpatches.Patch(color=PALETTE["risk"], label="! " + " | ".join(risk_flags))
        ax2.legend(handles=[patch], loc="upper right", framealpha=0.85, fontsize=8)

    fig2.tight_layout()
    path2 = os.path.join(output_dir, f"{learner_name.replace(' ', '_')}_subject_averages.png")
    fig2.savefig(path2, dpi=150, bbox_inches="tight")
    plt.close(fig2)
    chart_paths["bar_subject_average_marks"] = path2

    return chart_paths


def generate_narrative(learner_name: str, summary: dict, risk_flags: list[str], breakdown: list[dict]) -> str:
    strongest_subject = max(breakdown, key=lambda item: item["average_mark"], default=None)
    weakest_subject = min(breakdown, key=lambda item: item["average_mark"], default=None)

    sentences = [
        (
            f"{learner_name} is showing a {summary['overall_trend']} overall pattern, "
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


def run_analytics_automation(user_input: str, learner_name: str = "", records: list | None = None) -> dict:
    learner = learner_name or "Learner"
    rows = records or []

    if not rows:
        return {
            "output": "No learner records were provided for analysis.",
            "narrative": "",
            "analytics": {},
            "chart_paths": {},
            "risk_flags": [],
            "status": "no_input",
        }

    cleaned = []
    for row in rows:
        mark = safe_float(row.get("mark", 0))
        behavior_score = normalize_behavior_score(row.get("behavior", {}))
        progress_score = weighted_progress_score(mark, behavior_score)
        cleaned.append(
            {
                "date": row.get("date", ""),
                "date_obj": parse_date(row.get("date", "")),
                "subject": row.get("subject", "General"),
                "mark": round(mark, 2),
                "behavior_score": behavior_score,
                "progress_score": progress_score,
            }
        )

    cleaned.sort(key=lambda item: (item["date_obj"] is None, item["date_obj"] or datetime.min))

    marks = [item["mark"] for item in cleaned]
    behavior_scores = [item["behavior_score"] for item in cleaned]
    progress_scores = [item["progress_score"] for item in cleaned]

    summary = {
        "average_mark": round(statistics.mean(marks), 2),
        "average_behavior": round(statistics.mean(behavior_scores), 2),
        "average_progress": round(statistics.mean(progress_scores), 2),
        "mark_trend": calculate_trend(marks),
        "behavior_trend": calculate_trend(behavior_scores),
        "overall_trend": calculate_trend(progress_scores),
    }

    risk_flags = []
    if summary["average_mark"] < 50:
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

    chart_paths = build_charts(learner, cleaned, summary, risk_flags)
    breakdown = subject_breakdown(cleaned)
    narrative = generate_narrative(learner, summary, risk_flags, breakdown)

    output = (
        f"{learner}'s average mark is {summary['average_mark']}%, "
        f"behaviour score is {summary['average_behavior']}%, "
        f"overall progress score is {summary['average_progress']}%. "
        f"Mark trend: {summary['mark_trend']}. "
        f"Behaviour trend: {summary['behavior_trend']}. "
        f"Overall trend: {summary['overall_trend']}."
    )
    if risk_flags:
        output += " Risk flags: " + "; ".join(risk_flags) + "."

    return {
        "output": output,
        "narrative": narrative,
        "analytics": {
            "summary": summary,
            "risk_flags": risk_flags,
            "charts": charts,
        },
        "chart_paths": chart_paths,
        "risk_flags": risk_flags,
        "status": "ok",
        "topic": user_input,
    }
