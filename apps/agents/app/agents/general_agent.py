import os
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from app.core.language import get_language_instruction
from app.core.models import STANDARD_MODEL

# ─── LLM Setup ────────────────────────────────────────────────────────────────

def get_llm() -> ChatGoogleGenerativeAI | None:
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        return None

    return ChatGoogleGenerativeAI(
        model=STANDARD_MODEL,
        api_key=gemini_api_key,
        temperature=0.5,
        max_tokens=800,
    )

# ─── System Prompt ────────────────────────────────────────────────────────────

GENERAL_SYSTEM_PROMPT = """You are a warm, knowledgeable teaching companion supporting
educators who work with neurodivergent children aged 3–10 (autism spectrum, ADHD,
dyslexia, dyscalculia, sensory processing differences, PDA profile, twice-exceptional,
and related profiles).

YOUR ROLE:
You are the teacher's trusted colleague — the one they turn to when they need a quick,
honest, practical answer between lessons. You are not a textbook. You are not a
diagnosis tool. You are a supportive, informed presence who helps teachers feel
capable and confident.

WHAT YOU HANDLE:
- Classroom strategies and accommodation ideas
- Behaviour support and de-escalation approaches
- Parent and carer communication guidance
- IEP (Individual Education Plan) goal suggestions and wording
- Understanding neurodivergent profiles and what they mean in practice
- Sensory environment adjustments
- Transition and routine support
- Emotional regulation frameworks (Zones of Regulation, PDA-informed practice, etc.)
- Resource and tool recommendations (low/no cost where possible)
- General wellbeing support for the teacher themselves

RESPONSE PRINCIPLES:
1. Strengths-first always — open with what the child or situation has going for it
2. Practical over theoretical — every response must include at least one thing the
   teacher can try TODAY, with no preparation
3. Honest about limits — if something requires a specialist (SALT, OT, EP), say so
   clearly and warmly, without alarm
4. Bite-sized — use short paragraphs, not walls of text; the teacher is busy
5. Affirming of the teacher — this work is hard; acknowledge that without being
   patronising
6. Neurodivergent-affirming language throughout:
   - Say "the child may benefit from support with X" not "the child can't do X"
   - Say "this approach works well for many autistic children" not "autistic children
     need X" (avoid overgeneralising)
   - Use identity-first OR person-first language based on what the teacher uses first
   - Never use functioning labels (high/low functioning) — they are not clinically
     useful and can be harmful

BOUNDARIES — YOU NEVER:
- Provide medical diagnoses or suggest a child "sounds like" they have a condition
- Replace the advice of a qualified SENCO, educational psychologist, OT, or SALT
- Share specific medication information
- Make definitive statements about a child you have not observed
- Use language that pathologises normal neurodivergent behaviour

TONE:
Warm, direct, collegial. Like a trusted SENCO colleague who happens to have read
everything and remembers all of it — but never makes the teacher feel small for asking.

FORMAT GUIDANCE:
- For quick factual questions: 2–4 sentences, no headers needed
- For strategy requests: short intro + 2–3 numbered practical suggestions + one
  "quick win" they can try right now
- For emotional/wellbeing questions: lead with empathy, then practical signposting
- For IEP/documentation help: provide draft wording they can copy and adapt
- Never use bullet-within-bullet nesting
- Avoid academic citations unless specifically asked"""

# ─── Input Sanitization ───────────────────────────────────────────────────────

def sanitize_input(text: str) -> str:
    """Truncates to 800 chars — general questions can be longer than topic names."""
    return text.strip()[:800]


# ─── Context Builder ──────────────────────────────────────────────────────────

def build_context_note(state: dict) -> str:
    """
    Optionally enriches the prompt with teacher/learner context.
    All fields optional — agent is fully functional with input alone.

    Supported keys:
        learner_age   (int):  e.g. 7
        profile       (str):  e.g. "autistic, PDA profile"
        setting       (str):  e.g. "mainstream classroom", "special school", "home ed"
        teacher_role  (str):  e.g. "class teacher", "TA", "parent", "SENCO"
        urgency       (str):  "now" — flags that the teacher needs an immediate
                               in-the-moment strategy, not a long-term plan
    """
    lines = []

    age = state.get("learner_age")
    if age:
        lines.append(f"Child's age: {age} years old.")

    profile = state.get("profile")
    if profile:
        lines.append(f"Child's profile: {profile}.")

    setting = state.get("setting")
    if setting:
        lines.append(f"Setting: {setting}.")

    role = state.get("teacher_role")
    if role:
        lines.append(
            f"The person asking is a {role} — tailor the level of assumed knowledge "
            f"and available resources accordingly."
        )

    urgency = state.get("urgency", "").lower()
    if urgency == "now":
        lines.append(
            "URGENCY: The teacher needs an immediate, in-the-moment response. "
            "Lead with the single most useful thing they can do RIGHT NOW. "
            "Keep the full response under 100 words."
        )

    return (
        "\n\nCONTEXT:\n" + "\n".join(lines)
        if lines else ""
    )


# ─── Fallback ─────────────────────────────────────────────────────────────────

FALLBACK_RESPONSE = (
    "It looks like your message came through empty. "
    "Feel free to ask anything — whether it's a classroom strategy, "
    "help wording an IEP goal, advice on a tricky moment with a child, "
    "or just a question you've been meaning to ask."
)

# ─── Main Agent ───────────────────────────────────────────────────────────────

def general_agent(state: dict) -> dict:
    """
    General-purpose teaching companion for neurodivergent education support.
    Handles anything the other specialist agents don't cover.

    Args:
        state: {
            "input":        str,   # Required — the teacher's question or request
            "learner_age":  int,   # Optional
            "profile":      str,   # Optional — e.g. "ADHD, dyslexic"
            "setting":      str,   # Optional — e.g. "mainstream classroom"
            "teacher_role": str,   # Optional — e.g. "TA", "parent", "SENCO"
            "urgency":      str,   # Optional — pass "now" for immediate strategies
        }

    Returns:
        {
            "output":  str,   # The agent's response
            "status":  str,   # "ok" | "no_input"
        }
    """
    user_input = state.get("input", "").strip()

    if not user_input:
        return {
            "output": FALLBACK_RESPONSE,
            "status": "no_input",
        }

    question = sanitize_input(user_input)
    context_note = build_context_note(state)
    language_note = get_language_instruction(state)
    llm = get_llm()

    if llm is None:
        return {
            "output": "GEMINI_API_KEY is missing. Add it to your environment before running chat requests.",
            "status": "error",
        }

    user_message = (
        f"{question}"
        f"{context_note}"
    )

    response = llm.invoke([
        SystemMessage(content=GENERAL_SYSTEM_PROMPT + language_note),
        HumanMessage(content=user_message),
    ])

    return {
        "output": response.content.strip(),
        "status": "ok",
    }
