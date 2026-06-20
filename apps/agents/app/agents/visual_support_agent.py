import os
import re
from urllib.parse import quote_plus
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from app.core.language import get_language_instruction

# ─── LLM Setup ────────────────────────────────────────────────────────────────

def get_llm() -> ChatGoogleGenerativeAI | None:
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        return None

    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        api_key=gemini_api_key,
        temperature=0.4,
        max_tokens=1000,
    )

# ─── System Prompt ────────────────────────────────────────────────────────────

VISUAL_SUPPORT_SYSTEM_PROMPT = """You are an expert visual support specialist for
early years and primary education, with deep experience designing visual aids for
neurodivergent children aged 3–10 (autism spectrum, ADHD, dyslexia, sensory
processing differences, and related profiles).

YOUR ROLE:
Suggest ready-to-use visual supports that a classroom teacher — with no specialist
training — can create or source today, using basic materials or a printer.

NEURODIVERGENT-AFFIRMING DESIGN PRINCIPLES:
- Simple over complex: one idea per visual, no clutter
- Concrete over abstract: real photos beat clipart; clipart beats words alone
- Predictable formats: children recognise a now/next board faster if it always
  looks the same
- Sensory-aware: avoid visual supports that are too busy, high-contrast, or
  flickering for sensory-sensitive learners — flag this where relevant
- Strengths-led: frame visuals around what the child does, not what they avoid

VISUAL SUPPORT TYPES YOU DRAW FROM:
- Now/Next boards
- Visual schedules (daily, session, or task-specific)
- First/Then cards
- Social stories (illustrated sequence cards)
- Emotion/feeling charts (with faces, colour zones, or body maps)
- Step-by-step task visuals (e.g. handwashing, lining up)
- Choice boards
- Picture-word vocabulary cards
- Matching and sorting boards
- Reward/token boards
- Sensory regulation menus (calm-down corners, break cards)
- Visual timers (description of how to set one up)

OUTPUT FORMAT — use this structure exactly, with emoji markers:

VISUAL SUPPORT 1
Type: [name of the visual]
What it looks like: [one sentence — concrete and specific]
How to make it: [one or two steps, plain materials only]
Classroom use: [when and how the teacher deploys it]
Sensory note: [one line — any adaptations for sensory-sensitive learners]

VISUAL SUPPORT 2
[same structure]

VISUAL SUPPORT 3
[same structure]

INTERACTIVE IDEA
[One hands-on activity that reinforces the visuals above — movement or tactile element required]

QUICK-MAKE TIP
[One sentence: the single fastest visual a teacher could make right now with what's on their desk]

LANGUAGE RULES:
- Maximum 15 words per instruction step
- No jargon — if you use a term like "token economy", define it in brackets
- Write warmly, as if advising a colleague, not writing a report
- Never say "the child cannot" — say "the child may benefit from support with"
- Do NOT describe generating actual images — only describe what the teacher makes"""

# ─── YouTube Link Builder ─────────────────────────────────────────────────────

# Keyword triggers for YouTube detection — checked against lowercased input
YOUTUBE_TRIGGERS = frozenset([
    "youtube", "video", "videos", "link", "links",
    "watch", "show me", "find a video", "clip", "clips",
])

# Query templates — ordered from most specific to broadest
YOUTUBE_QUERY_TEMPLATES = [
    "{topic} visual support autism classroom",
    "{topic} for neurodivergent kids learning video",
    "{topic} early years SEND teaching resource",
]


def wants_youtube_links(text: str) -> bool:
    """
    Detects video/YouTube intent using whole-word matching to avoid
    false positives (e.g. 'overview' matching 'video' in naive substring search).
    """
    lowered = text.lower()
    return any(
        re.search(rf"\b{re.escape(trigger)}\b", lowered)
        for trigger in YOUTUBE_TRIGGERS
    )


def build_youtube_links(topic: str) -> list[dict[str, str]]:
    """
    Returns structured dicts instead of bare URLs so downstream agents
    and UIs can render labelled links rather than raw query strings.

    Each dict: {"label": str, "url": str}
    """
    links = []
    for template in YOUTUBE_QUERY_TEMPLATES:
        query = template.format(topic=topic)
        url = f"https://www.youtube.com/results?search_query={quote_plus(query)}"
        links.append({"label": query, "url": url})
    return links


# ─── Input Sanitization ───────────────────────────────────────────────────────

def sanitize_input(text: str) -> str:
    """
    Truncates to 300 chars — a visual support topic needs no more.
    Prevents prompt injection via the topic field.
    """
    return text.strip()[:300]


# ─── Main Agent ───────────────────────────────────────────────────────────────

FALLBACK_RESPONSE = (
    "No topic was provided. Please describe what you would like visual support "
    "ideas for — for example: 'morning routine', 'sharing and turn-taking', "
    "or 'the water cycle'."
)


def visual_support_agent(state: dict) -> dict:
    """
    Generates classroom-ready visual support ideas for neurodivergent learners.

    Args:
        state: {
            "input":       str,   # Required — topic or theme
            "learner_age": int,   # Optional — e.g. 5
            "profile":     str,   # Optional — e.g. "autistic, sensory-seeking"
            "setting":     str,   # Optional — e.g. "home", "classroom", "therapy room"
        }

    Returns:
        {
            "output":         str,          # Structured visual support suggestions
            "topic":          str,          # Sanitized input topic (for logging/chaining)
            "youtube_links":  list[dict],   # [{"label": str, "url": str}] or []
            "status":         str,          # "ok" | "no_input"
        }
    """
    user_input = state.get("input", "").strip()

    if not user_input:
        return {
            "output":        FALLBACK_RESPONSE,
            "topic":         "",
            "youtube_links": [],
            "status":        "no_input",
        }

    topic = sanitize_input(user_input)
    llm = get_llm()

    if llm is None:
        return {
            "output": "GROQ_API_KEY is missing. Add it to your environment before running chat requests.",
            "topic": topic,
            "youtube_links": [],
            "status": "error",
        }

    # ── Optional context enrichment ───────────────────────────────────────────
    context_lines = []

    age = state.get("learner_age")
    if age:
        context_lines.append(f"Learner age: {age} years old.")

    profile = state.get("profile")
    if profile:
        context_lines.append(f"Learner profile: {profile}.")

    setting = state.get("setting")
    if setting:
        context_lines.append(
            f"Setting: {setting} — tailor material availability advice accordingly."
        )

    context_block = (
        "\n\nADDITIONAL CONTEXT:\n" + "\n".join(context_lines)
        if context_lines else ""
    )

    user_message = (
        f"Please suggest visual supports for the following topic:\n\n"
        f"TOPIC: {topic}"
        f"{context_block}"
    )

    # ── LLM Call ──────────────────────────────────────────────────────────────
    language_note = get_language_instruction(state)
    response = llm.invoke([
        SystemMessage(content=VISUAL_SUPPORT_SYSTEM_PROMPT + language_note),
        HumanMessage(content=user_message),
    ])

    # ── YouTube Links ─────────────────────────────────────────────────────────
    youtube_links = (
        build_youtube_links(topic) if wants_youtube_links(user_input) else []
    )

    return {
        "output":        response.content.strip(),
        "topic":         topic,
        "youtube_links": youtube_links,
        "status":        "ok",
    }
