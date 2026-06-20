import os
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
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
        temperature=0.5,
        max_tokens=800,
    )

# ─── System Prompt ────────────────────────────────────────────────────────────

LESSON_SYSTEM_PROMPT = """You are an expert educational therapist and lesson designer
specialising in neurodivergent learners aged 3–10 (ADHD, autism spectrum, dyslexia,
dyscalculia, sensory processing differences, and related profiles).

YOUR ROLE:
You design short, structured, joyful lesson plans that meet children where they are —
not where the curriculum expects them to be.

NEURODIVERGENT-AFFIRMING PRINCIPLES YOU ALWAYS FOLLOW:
- Strengths-first: frame every activity around what the child CAN do
- Predictability: every lesson has the same three-part rhythm — Warm Up, Main Activity, Cool Down
- Sensory awareness: always offer a low-stimulation AND a high-stimulation activity variant
- Movement integration: include at least one physical/kinesthetic element per lesson
- Chunking: break every instruction into single-action steps (no multi-step sentences)
- Avoid deficit language: never say "can't", "won't", or "struggles to" — say "may need support with"

LESSON STRUCTURE YOU ALWAYS USE:

 WARM UP (3–4 min)
- One grounding activity to signal "learning time is starting"
- Options: breathing exercise, object labelling, a simple yes/no question

 MAIN ACTIVITY (10–12 min)
- Core concept introduced through play, story, or movement
- Clear single-step instructions
- One tactile/visual/hands-on element included

 COOL DOWN (2–3 min)
- One reflection prompt ("What's one thing you noticed?")
- A closing ritual (e.g. high five, star jump, quiet breath)

ADAPTATION SECTION (always included):
-  Low-stimulation version (for sensory-sensitive or low-energy days)
-  High-engagement version (for high-energy or sensory-seeking days)
-  Short version (if attention window is under 10 min today)

LANGUAGE RULES:
- Use plain, warm English — maximum 12 words per instruction step
- No jargon, no acronyms unless defined
- Write as if speaking to a kind, capable teacher who is not a specialist

OUTPUT FORMAT:
Return the lesson plan as clean plain text with emoji section markers as shown above.
No markdown headers, no bullet-within-bullet nesting, no tables."""

# ─── Input Validation ─────────────────────────────────────────────────────────

FALLBACK_RESPONSE = (
    "I wasn't given a topic to plan a lesson around. "
    "Please provide a subject or theme — for example: "
    "'counting with blocks', 'emotions and feelings', or 'the letter S'."
)


def sanitize_input(text: str) -> str:
    """
    Basic guard against prompt injection via the topic field.
    Truncates to 300 chars — a lesson topic should never be longer.
    """
    return text.strip()[:300]


# ─── Age/Profile Context Builder ──────────────────────────────────────────────

def build_context_note(state: dict) -> str:
    """
    Optionally enriches the prompt with learner profile context if provided.
    All fields are optional — agent works without them.

    Supported state keys:
        learner_age   (int):   e.g. 6
        profile       (str):   e.g. "ADHD, sensory-seeking"
        interests     (str):   e.g. "dinosaurs, trains"
        session_length (int):  override in minutes, e.g. 10
    """
    notes = []

    age = state.get("learner_age")
    if age:
        notes.append(f"Learner age: {age} years old.")

    profile = state.get("profile")
    if profile:
        notes.append(f"Learner profile: {profile}.")

    interests = state.get("interests")
    if interests:
        notes.append(
            f"Learner interests (weave these into activities if possible): {interests}."
        )

    session_length = state.get("session_length")
    if session_length:
        notes.append(
            f"Target session length today: {session_length} minutes — "
            f"adjust activity timing accordingly."
        )

    return ("\n\nADDITIONAL LEARNER CONTEXT:\n" + "\n".join(notes)) if notes else ""


# ─── Main Agent ───────────────────────────────────────────────────────────────

def lesson_planner_agent(state: dict) -> dict:
    """
    Generates a structured, neurodivergent-affirming lesson plan.

    Args:
        state: {
            "input":          str,           # Required — lesson topic or theme
            "learner_age":    int,           # Optional — defaults to age 3–10 range
            "profile":        str,           # Optional — e.g. "autistic, dyslexic"
            "interests":      str,           # Optional — e.g. "space, Lego"
            "session_length": int,           # Optional — target minutes, default 15–20
        }

    Returns:
        {
            "output":  str,    # Full structured lesson plan
            "topic":   str,    # Echo of the input topic (for logging/chaining)
            "status":  str,    # "ok" | "no_input"
        }
    """
    user_input = state.get("input", "").strip()

    if not user_input:
        return {
            "output": FALLBACK_RESPONSE,
            "topic":  "",
            "status": "no_input"
        }

    topic = sanitize_input(user_input)
    context_note = build_context_note(state)
    language_note = get_language_instruction(state)
    llm = get_llm()

    if llm is None:
        return {
            "output": "GEMINI_API_KEY is missing. Add it to your environment before running chat requests.",
            "topic": topic,
            "status": "error",
        }

    rag_context = state.get("rag_context", "").strip()
    rag_section = (
        f"\n\nCURRICULUM CONTEXT (from DCAPS — use this to ground the lesson in the formal curriculum):\n{rag_context}"
        if rag_context else ""
    )

    user_message = (
        f"Please create a lesson plan for the following topic:\n\n"
        f"TOPIC: {topic}"
        f"{context_note}"
        f"{rag_section}"
    )

    response = llm.invoke([
        SystemMessage(content=LESSON_SYSTEM_PROMPT + language_note),
        HumanMessage(content=user_message)
    ])

    return {
        "output": response.content.strip(),
        "topic":  topic,
        "status": "ok"
    }
