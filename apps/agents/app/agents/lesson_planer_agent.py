import base64
import logging
import os
import re
from urllib.parse import quote_plus

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from app.core.language import get_language_instruction

logger = logging.getLogger(__name__)

# ─── LLM Setup ────────────────────────────────────────────────────────────────

def get_llm() -> ChatGoogleGenerativeAI | None:
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        return None

    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        api_key=gemini_api_key,
        temperature=0.5,
        max_tokens=3000,
    )

# ─── System Prompt ────────────────────────────────────────────────────────────

LESSON_SYSTEM_PROMPT = """You are an expert assessment and pedagogical planner specialising \
in inclusive education for neurodivergent learners aged 5–18 (ADHD, autism spectrum, dyslexia, \
dyscalculia, sensory processing differences, and related profiles).

YOUR ROLE:
Create a COMPLETE, practical assessment and pedagogical plan a classroom teacher with no \
specialist training can use immediately. Plans must address diversity of learning needs from the \
outset, not as an afterthought. Never truncate or stop early — always produce the entire plan.

NEURODIVERGENT-AFFIRMING PRINCIPLES:
- Universal Design for Learning: multiple means of representation, action, and engagement
- Strengths-first: frame every task around what the learner CAN demonstrate
- Scaffolded challenge: clear support pathways alongside stretch activities
- Sensory and processing awareness: flag high-demand tasks and provide low-demand alternatives
- Chunked instructions: no multi-step sentences; one action per step

OUTPUT STRUCTURE — use exactly these section headers, every time:

PLAN OVERVIEW
Subject / Topic / Grade: [as provided]
Estimated time: [specify in minutes for the full session]
Learning focus: [one clear sentence describing what learners will understand or be able to do]

LEARNING OBJECTIVES (3–4 measurable objectives)
• [Observable, assessable objective starting with an action verb]
• [Observable, assessable objective]
• [Observable, assessable objective]
• [Optional fourth objective for breadth]

ASSESSMENT DESIGN
Main task: [clear description of what learners will produce or demonstrate]
Format options: [list 2–3 alternative response formats, e.g. written, verbal, visual, hands-on]
Time allowance: [recommended time with a note on extensions for those who need it]
Instructions to learners: [3–5 plain-language steps the teacher can read aloud or display]

DIFFERENTIATION TIERS

TIER 1 — FOUNDATION (learners needing maximum scaffolding)
Task: [simplified version of the main task]
Scaffolds provided: [word banks, sentence frames, visuals, graphic organisers, etc.]
Success looks like: [one concrete sentence]

TIER 2 — CORE (the majority of the class)
Task: [standard version of the main task]
Extension: [one enrichment prompt if learners finish early]
Success looks like: [one concrete sentence]

TIER 3 — STRETCH (learners ready for advanced challenge)
Task: [extended or more abstract version of the main task]
Deep thinking: [one open-ended higher-order question]
Success looks like: [one concrete sentence]

MARKING CRITERIA (simplified rubric — 4 levels)
Exceeding expectations: [what the learner demonstrates]
Meeting expectations: [what the learner demonstrates]
Approaching expectations: [what the learner demonstrates]
Beginning: [what the learner demonstrates]

ACCOMMODATION CHECKLIST
Tick what applies before the lesson:
□ Extended time — add [X] minutes beyond the standard allowance
□ Reduced writing load — accept voice recording or drawing instead
□ Visual schedule displayed so the learner can track progress
□ Word bank or sentence starters provided on the desk
□ Read-aloud: teacher or peer reads instructions aloud
□ Movement break after each tier task
□ Quiet workspace or noise-reducing headphones available
□ [Additional accommodation based on the specific support need provided]

MATERIALS AND RESOURCES
• [List each item, tool, or printable needed — be specific]
• [Digital or low-tech alternatives where relevant]

TEACHER PREPARATION NOTES
Before the lesson: [1–2 things the teacher must prepare in advance]
During the lesson: [1 key thing to watch for and respond to]
After the lesson: [1 quick reflection or follow-up step]

FOLLOW-UP ACTIVITY (for the next session)
[One consolidation or extension activity that builds directly on this plan — 3–5 sentences]

LANGUAGE RULES:
- Maximum 15 words per instruction step
- No jargon — define any specialist term in brackets on first use
- Write warmly, as if advising a trusted teaching colleague
- Never say "the learner cannot" — say "the learner may benefit from support with"
- Do NOT stop early. Complete every section before finishing."""

# ─── Input Validation ─────────────────────────────────────────────────────────

FALLBACK_RESPONSE = (
    "I wasn't given enough detail to build an assessment plan. "
    "Please provide a subject, topic, and grade level — for example: "
    "'Grade 4 Mathematics on fractions and equivalence'."
)


def sanitize_input(text: str) -> str:
    return text.strip()[:600]


# ─── Context Builder ──────────────────────────────────────────────────────────

def build_context_note(state: dict) -> str:
    notes = []

    grade = state.get("grade")
    if grade:
        notes.append(f"Grade level: {grade}.")

    subject = state.get("subject")
    if subject:
        notes.append(f"Subject: {subject}.")

    topic = state.get("topic")
    if topic:
        notes.append(f"Topic / concept: {topic}.")

    support_need = state.get("support_need")
    if support_need:
        notes.append(
            f"Specific support need to address in accommodations: {support_need}."
        )

    profile = state.get("profile")
    if profile:
        notes.append(f"Learner profile context: {profile}.")

    session_length = state.get("session_length")
    if session_length:
        notes.append(f"Target session length: {session_length} minutes.")

    rag_context = (state.get("rag_context") or "").strip()
    if rag_context:
        notes.append(
            f"\nCURRICULUM CONTEXT (from DCAPS — ground the plan in the formal curriculum):\n{rag_context}"
        )

    return ("\n\nADDITIONAL CONTEXT:\n" + "\n".join(notes)) if notes else ""


# ─── YouTube Link Builder ──────────────────────────────────────────────────────

_YOUTUBE_TEMPLATES = [
    "teaching {topic} {grade_ctx} inclusive classroom strategies",
    "{topic} visual aids {subject_ctx} neurodivergent learners lesson",
    "{grade_ctx} {subject_ctx} {topic} educational video teachers",
]


def build_youtube_links(topic: str, subject: str = "", grade: str = "") -> list[dict]:
    """
    Always generates 3 YouTube search links for the lesson topic.
    Returns list of {"label": str, "url": str}.
    """
    grade_ctx = f"Grade {grade}" if grade else "primary school"
    subject_ctx = subject if subject else "classroom"

    links = []
    for template in _YOUTUBE_TEMPLATES:
        query = template.format(topic=topic, grade_ctx=grade_ctx, subject_ctx=subject_ctx)
        url = f"https://www.youtube.com/results?search_query={quote_plus(query)}"
        links.append({"label": query, "url": url})
    return links


# ─── Image Generation ─────────────────────────────────────────────────────────

def generate_image_aids(topic: str, subject: str = "", grade: str = "") -> list[dict]:
    """
    Generates 1–2 educational visual aid images using Gemini's image generation model.
    Returns list of {"label": str, "url": str} where url is a data URI.
    Silently returns [] on any failure so a text plan is never blocked.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return []

    grade_ctx = f"Grade {grade} " if grade else ""
    subject_ctx = f"{subject} " if subject else ""

    prompts = [
        (
            f"Create a simple, clear educational classroom display poster for teaching "
            f"'{topic}' in a {grade_ctx}{subject_ctx}lesson. "
            f"Style: bold colours (max 4), clean white background, large readable labels, "
            f"simple diagrams or icons, no photorealism. Classroom poster format."
        ),
        (
            f"Create a step-by-step visual task card for a {grade_ctx}{subject_ctx}activity "
            f"about '{topic}'. Show numbered steps with simple icons. "
            f"Clean white background, bold outlines, inclusive classroom style."
        ),
    ]

    images = []
    try:
        from google import genai  # type: ignore[import-not-found]
        from google.genai import types  # type: ignore[import-not-found]

        client = genai.Client(api_key=api_key)

        for i, prompt in enumerate(prompts):
            try:
                response = client.models.generate_content(
                    model="gemini-2.0-flash-preview-image-generation",
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_modalities=["IMAGE"],
                    ),
                )
                for part in response.candidates[0].content.parts:
                    if hasattr(part, "inline_data") and part.inline_data:
                        raw = part.inline_data.data
                        img_b64 = (
                            base64.b64encode(raw).decode("utf-8")
                            if isinstance(raw, bytes)
                            else raw
                        )
                        mime = part.inline_data.mime_type or "image/png"
                        label = (
                            f"Concept Diagram: {topic}"
                            if i == 0
                            else f"Activity Task Card: {topic}"
                        )
                        images.append({"label": label, "url": f"data:{mime};base64,{img_b64}"})
                        break
            except Exception as img_exc:
                logger.warning("Image %d generation failed: %s", i + 1, img_exc)

    except ImportError:
        logger.info("google-genai not installed; image generation skipped")
    except Exception as exc:
        logger.warning("Image generation session failed: %s", exc)

    return images


# ─── Main Agent ───────────────────────────────────────────────────────────────

def lesson_planner_agent(state: dict) -> dict:
    """
    Generates a complete, neurodivergent-affirming assessment and pedagogical plan,
    plus YouTube links and AI-generated visual aid images.

    Args:
        state: {
            "input":          str,   # Required — free-text request or topic
            "grade":          str,   # Optional — e.g. "5"
            "subject":        str,   # Optional — e.g. "Mathematics"
            "topic":          str,   # Optional — e.g. "Fractions and equivalence"
            "support_need":   str,   # Optional — e.g. "reduced writing load, visual scaffolds"
            "profile":        str,   # Optional — e.g. "autistic, dyslexic"
            "session_length": int,   # Optional — target minutes
            "rag_context":    str,   # Optional — DCAPS curriculum text from RAG router
        }

    Returns:
        {
            "output":       str,        # Full structured plan
            "topic":        str,        # Echoed input topic
            "status":       str,        # "ok" | "no_input" | "error"
            "youtube_links":list[dict], # Always 3 — [{"label": str, "url": str}]
            "image_aids":   list[dict], # 0–2 — [{"label": str, "url": str}] data URIs
        }
    """
    user_input = state.get("input", "").strip()

    if not user_input:
        return {
            "output":        FALLBACK_RESPONSE,
            "topic":         "",
            "status":        "no_input",
            "youtube_links": [],
            "image_aids":    [],
        }

    topic_raw = sanitize_input(user_input)

    # Prefer explicit state fields; fall back to parsing the free-text input
    grade   = state.get("grade", "")   or _extract_field(user_input, "grade")
    subject = state.get("subject", "") or _extract_field(user_input, "subject")
    topic   = state.get("topic", "")   or _extract_field(user_input, "topic") or topic_raw

    context_note  = build_context_note(state)
    language_note = get_language_instruction(state)
    llm           = get_llm()

    if llm is None:
        return {
            "output":        "GEMINI_API_KEY is missing. Add it to your environment before running chat requests.",
            "topic":         topic,
            "status":        "error",
            "youtube_links": [],
            "image_aids":    [],
        }

    user_message = (
        f"Please create a complete Assessment and Pedagogical Plan for the following:\n\n"
        f"REQUEST: {topic_raw}"
        f"{context_note}\n\n"
        f"Important: complete every section of the plan without stopping early."
    )

    response = llm.invoke([
        SystemMessage(content=LESSON_SYSTEM_PROMPT + language_note),
        HumanMessage(content=user_message),
    ])

    youtube_links = build_youtube_links(topic, subject=subject, grade=grade)
    image_aids    = generate_image_aids(topic, subject=subject, grade=grade)

    return {
        "output":        response.content.strip(),
        "topic":         topic,
        "status":        "ok",
        "youtube_links": youtube_links,
        "image_aids":    image_aids,
    }


# ─── Field Extractor ──────────────────────────────────────────────────────────

def _extract_field(text: str, field: str) -> str:
    """
    Extracts structured fields embedded in the lesson planner message format:
      "Grade: 5. Subject: Mathematics. Topic: Fractions."
    Returns empty string if not found.
    """
    match = re.search(rf"{re.escape(field)}:\s*([^.\n]+)", text, re.IGNORECASE)
    return match.group(1).strip() if match else ""
