import logging
import os

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from app.core.language import get_language_instruction
from app.core.models import STANDARD_MODEL

logger = logging.getLogger(__name__)

# ─── LLM Setup ────────────────────────────────────────────────────────────────

def get_llm() -> ChatGoogleGenerativeAI | None:
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        return None

    return ChatGoogleGenerativeAI(
        model=STANDARD_MODEL,
        api_key=gemini_api_key,
        temperature=0.5,
        max_tokens=1500,
    )

# ─── System Prompt ────────────────────────────────────────────────────────────

BASE_SYSTEM_PROMPT = """You are an experienced, warm classroom teacher writing a letter home
to the parent or carer of a neurodivergent child (autism spectrum, ADHD, dyslexia,
dyscalculia, sensory processing differences, PDA profile, twice-exceptional, and related
profiles).

YOUR TASK:
Produce ONE complete, ready-to-send letter that the teacher can review, lightly edit, and
send. It must read as a finished letter, not notes or bullet points.

LETTER STRUCTURE (use this exact order, as flowing prose — no markdown, no headers):
1. Date line — write it literally as "[Date]" for the teacher to fill in.
2. Greeting — "Dear Parent/Carer," (or use the parent's name if one is provided).
3. Opening — a warm, personal sentence that sets a collaborative, respectful tone.
4. Body — 2–3 short paragraphs conveying the message (see the mode guidance below).
5. Supporting at home — one short paragraph offering ONE or TWO concrete, low-effort
   things the parent can try at home. Frame them as gentle invitations, not instructions.
6. Closing — a warm sentence inviting the parent to reply, ask questions, or meet.
7. Sign-off — "Kind regards," on its own line, then "[Your name]" on the next line.

LANGUAGE RULES:
- Plain, everyday language. No educational jargon. If a specialist term is unavoidable,
  explain it in brackets the first time you use it.
- Neurodivergent-affirming throughout: say "may benefit from support with X", never
  "can't do X" or "struggles with X". Avoid functioning labels (high/low functioning).
- Strengths-first: lead with what is going well for the child.
- Warm, respectful, and human — write to the parent as a valued partner.
- Keep the whole letter to roughly 250–350 words so it can be read in one sitting.

HONESTY GUARDRAILS:
- Do NOT invent specific facts — no test scores, exact dates, named incidents, or
  diagnoses — unless the teacher's notes explicitly provide them. Where you have no
  specifics, keep statements general and observational.
- Never include medical or diagnostic claims about the child."""

PROGRESS_GUIDANCE = """MODE: PROGRESS REPORT
This is a positive, encouraging update. Celebrate genuine progress and effort. Highlight
specific strengths and growth (kept general unless the teacher gave specifics). Acknowledge
one area the child is still developing, framed warmly as a next step rather than a problem.
The overall feeling should leave the parent proud and reassured."""

CONCERN_GUIDANCE = """MODE: CONCERN LETTER
This raises a concern with care and without alarm. Open by affirming the child and the
partnership. State the concern plainly, kindly, and specifically, focusing on observable
patterns rather than judgements. Make clear this is about working together to support the
child, not about blame. Emphasise that the concern is manageable and that you are committed
to helping. The overall feeling should leave the parent informed and reassured, not anxious."""

# ─── Helpers ──────────────────────────────────────────────────────────────────

def sanitize_input(text: str) -> str:
    return text.strip()[:1500]


FALLBACK_RESPONSE = (
    "I need a little more to work with. Please choose a learner and a letter type "
    "(progress report or concern letter), and optionally jot a few notes about what "
    "you'd like the letter to say."
)


def _resolve_type(state: dict) -> str:
    """Return 'progress' or 'concern', inferring from free text when not given explicitly."""
    comm_type = (state.get("communication_type") or "").strip().lower()
    if comm_type in ("progress", "concern"):
        return comm_type
    text = (state.get("input") or "").lower()
    return "concern" if "concern" in text else "progress"


# ─── Main Agent ───────────────────────────────────────────────────────────────

def parent_comm_agent(state: dict) -> dict:
    """
    Drafts a complete parent-communication letter (progress report or concern letter)
    for a neurodivergent learner.

    Args:
        state: {
            "input":              str,   # Optional — teacher's notes / context to incorporate
            "communication_type": str,   # "progress" | "concern" (inferred from input if absent)
            "learner_name":       str,   # Optional — learner label or pseudonym
            "language_pref":      str,   # Optional — SA language code
        }

    Returns:
        {
            "output":             str,   # The finished letter
            "communication_type": str,   # Resolved type, for the caller
            "status":             str,   # "ok" | "error"
        }
    """
    comm_type = _resolve_type(state)
    learner_name = (state.get("learner_name") or "").strip()
    notes = sanitize_input(state.get("input") or "")

    llm = get_llm()
    if llm is None:
        return {
            "output": "GEMINI_API_KEY is missing. Add it to your environment before running chat requests.",
            "communication_type": comm_type,
            "status": "error",
        }

    mode_guidance = PROGRESS_GUIDANCE if comm_type == "progress" else CONCERN_GUIDANCE
    language_note = get_language_instruction(state)

    context_lines = []
    if learner_name:
        context_lines.append(
            f"The letter concerns a learner referred to as '{learner_name}'. Refer to the "
            f"child naturally; do not expose any anonymised ID codes in the letter body."
        )
    if notes:
        context_lines.append(
            f"Incorporate the teacher's notes below. Expand them into a complete letter; "
            f"do not invent specifics beyond what they imply:\n{notes}"
        )
    else:
        context_lines.append(
            "The teacher has not provided specific notes. Write a thoughtful, general "
            f"{comm_type} letter that the teacher can personalise with specifics."
        )

    user_message = (
        f"Please write a parent {comm_type} letter.\n\n"
        + "\n\n".join(context_lines)
    )

    try:
        response = llm.invoke([
            SystemMessage(content=BASE_SYSTEM_PROMPT + "\n\n" + mode_guidance + language_note),
            HumanMessage(content=user_message),
        ])
    except Exception as exc:
        logger.error("Parent communication agent LLM call failed: %s", exc)
        return {
            "output": "The AI assistant encountered an error drafting the letter. Please try again.",
            "communication_type": comm_type,
            "status": "error",
        }

    return {
        "output": response.content.strip(),
        "communication_type": comm_type,
        "status": "ok",
    }
