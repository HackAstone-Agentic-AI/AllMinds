import os
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
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

MULTIMODAL_SYSTEM_PROMPT = """You are an expert multimodal learning designer for
neurodivergent children aged 3–10 (autism spectrum, ADHD, dyslexia, dyscalculia,
sensory processing differences, and related profiles).

YOUR ROLE:
For any topic a teacher gives you, design a complete multimodal learning experience
that reaches children through text, vision, touch, movement, and sound — because
neurodivergent learners often access understanding through ONE strong channel, and
your job is to cover all of them.

THE FIVE LEARNING CHANNELS YOU ALWAYS ADDRESS:

 TEXT EXPLANATION
- 3–5 sentences maximum
- One idea per sentence — no compound clauses
- Concrete nouns over abstract concepts (say "the frog jumps" not "locomotion occurs")
- Refer to the learner as "the learner" or "the child" throughout — do not invent or substitute names
- Avoid metaphors unless immediately explained

 VISUAL AIDS
- Describe exactly what the teacher draws, prints, or displays
- Include layout: left-to-right sequence, top-to-bottom list, circular diagram, etc.
- Specify whether real photos, simple clipart, or hand-drawn stick figures work best
- Always include a colour-coding suggestion (one colour per concept — max 3 colours)
- Flag if any visual could be overwhelming for sensory-sensitive learners

 HANDS-ON / TACTILE ACTIVITIES
- At least one activity using objects already in a classroom or home
- One fine motor option (threading, sorting, sticking)
- One gross motor option (jumping, clapping, pointing)
- Keep setup under 2 minutes

 AUDIO / VERBAL SUPPORTS
- A simple chant, rhyme, or call-and-response the teacher can use
- Keep it under 8 words per line
- Clapping rhythm optional but noted

 SENSORY REGULATION TIE-IN
- One suggestion for how to ground a dysregulated child back into the activity
- Must be usable mid-lesson without stopping the class

ADAPTATION TIERS (always include all three):
 Quiet/low-energy version — for sensory-sensitive or low-stimulation days
 High-energy version — for sensory-seeking or high-stimulation days
 5-minute version — single most impactful element if time is very short

LANGUAGE RULES:
- Maximum 12 words per instruction
- No jargon — define any specialist term immediately in brackets
- Warm, encouraging tone throughout — write as if coaching a kind teacher
- Never use deficit framing — say "may benefit from" not "cannot" or "struggles with"
- Do NOT claim to generate actual images, audio files, or videos"""

# ─── Input Sanitization ───────────────────────────────────────────────────────

def sanitize_input(text: str) -> str:
    """Truncates to 300 chars — prevents prompt injection via topic field."""
    return text.strip()[:300]


# ─── Context Builder ──────────────────────────────────────────────────────────

def build_context_note(state: dict) -> str:
    """
    Enriches the prompt with optional learner/session context.
    All fields optional — agent works with topic alone.

    Supported keys:
        learner_age    (int):  e.g. 7
        profile        (str):  e.g. "autistic, strong auditory learner"
        interests      (str):  e.g. "space, dinosaurs"
        dominant_channel (str): e.g. "visual" | "auditory" | "kinesthetic"
        session_length (int):  target minutes, e.g. 10
        setting        (str):  e.g. "classroom", "home", "therapy room"
    """
    lines = []

    age = state.get("learner_age")
    if age:
        lines.append(f"Learner age: {age} years old.")

    profile = state.get("profile")
    if profile:
        lines.append(f"Learner profile: {profile}.")

    interests = state.get("interests")
    if interests:
        lines.append(
            f"Learner interests — weave these into examples where natural: {interests}."
        )

    channel = state.get("dominant_channel")
    if channel:
        lines.append(
            f"Dominant learning channel: {channel} — lead with this channel's "
            f"section and expand it with an extra example."
        )

    length = state.get("session_length")
    if length:
        lines.append(
            f"Session length today: {length} minutes — "
            f"scale activity timing accordingly."
        )

    setting = state.get("setting")
    if setting:
        lines.append(
            f"Setting: {setting} — only suggest materials available in this environment."
        )

    return (
        "\n\nADDITIONAL LEARNER CONTEXT:\n" + "\n".join(lines)
        if lines else ""
    )


# ─── Fallback ─────────────────────────────────────────────────────────────────

FALLBACK_RESPONSE = (
    "No topic was provided. Please share a subject or theme to design a "
    "multimodal learning experience around — for example: 'the seasons', "
    "'numbers 1 to 5', or 'how plants grow'."
)

# ─── Main Agent ───────────────────────────────────────────────────────────────

def multimodal_agent(state: dict) -> dict:
    """
    Designs a complete multimodal learning experience for a neurodivergent learner.

    Args:
        state: {
            "input":            str,   # Required — topic or theme
            "learner_age":      int,   # Optional
            "profile":          str,   # Optional — e.g. "ADHD, kinesthetic learner"
            "interests":        str,   # Optional — e.g. "trains, superheroes"
            "dominant_channel": str,   # Optional — "visual"|"auditory"|"kinesthetic"
            "session_length":   int,   # Optional — target minutes
            "setting":          str,   # Optional — "classroom"|"home"|"therapy room"
        }

    Returns:
        {
            "output":  str,   # Full multimodal learning experience plan
            "topic":   str,   # Sanitized input topic (for logging/chaining)
            "status":  str,   # "ok" | "no_input"
        }
    """
    user_input = state.get("input", "").strip()

    if not user_input:
        return {
            "output": FALLBACK_RESPONSE,
            "topic":  "",
            "status": "no_input",
        }

    topic = sanitize_input(user_input)
    context_note = build_context_note(state)
    llm = get_llm()

    if llm is None:
        return {
            "output": "GEMINI_API_KEY is missing. Add it to your environment before running chat requests.",
            "topic": topic,
            "status": "error",
        }

    user_message = (
        f"Please design a multimodal learning experience for the following topic:\n\n"
        f"TOPIC: {topic}"
        f"{context_note}"
    )

    response = llm.invoke([
        SystemMessage(content=MULTIMODAL_SYSTEM_PROMPT),
        HumanMessage(content=user_message),
    ])

    return {
        "output": response.content.strip(),
        "topic":  topic,
        "status": "ok",
    }
