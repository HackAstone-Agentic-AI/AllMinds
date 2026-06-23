import logging
import os
import re
from concurrent.futures import ThreadPoolExecutor, Future

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from app.core.language import get_language_instruction
from app.core.models import PRO_MODEL
from app.core.visual_media import build_lesson_youtube_links, generate_image_aids

logger = logging.getLogger(__name__)

# ─── LLM Setup ────────────────────────────────────────────────────────────────

def get_llm() -> ChatGoogleGenerativeAI | None:
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        return None

    return ChatGoogleGenerativeAI(
        model=PRO_MODEL,
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
Difficulty level: [Foundation / Intermediate / Advanced — match to grade and support needs]
Estimated time: [specify in minutes for the full session]
Learning focus: [one clear sentence describing what learners will understand or be able to do]
Curriculum alignment: [key skill or concept strand this addresses]

LEARNING OBJECTIVES (3–4 measurable objectives)
• [Observable, assessable objective starting with an action verb]
• [Observable, assessable objective]
• [Observable, assessable objective]
• [Optional fourth objective for breadth]

LESSON ACTIVITIES & TIMELINE
[For each activity block, specify the timing in minutes, the activity name, and a 1–2 sentence description]
• [0–5 min]  Warm-up / Activation: [hook activity to activate prior knowledge]
• [5–20 min] Direct Instruction: [how the teacher introduces the concept — model, demonstrate, or narrate]
• [20–35 min] Guided Practice: [learners attempt with teacher support — specify the task]
• [35–45 min] Independent or Group Task: [learners apply learning independently or in pairs/groups]
• [45–50 min] Closure / Reflection: [how learning is consolidated and checked]
Adapt timing proportionally if the session is shorter or longer than 50 minutes.

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

WORKSHEET_SYSTEM_PROMPT = """You are an expert inclusive education designer specialising in \
neurodivergent learners aged 5–18. Create a complete, ready-to-print worksheet a classroom \
teacher can hand out immediately. Never truncate — produce the full worksheet.

OUTPUT STRUCTURE:
WORKSHEET TITLE
[Clear, friendly title the learner sees]

INSTRUCTIONS TO LEARNER
[3–5 plain-language steps — one action each, max 12 words per step]

SECTION 1 — WARM-UP (2–4 short recall or matching questions)
[Questions with answer space below each]

SECTION 2 — MAIN PRACTICE (6–10 questions or tasks graded easy → harder)
[Each question numbered, with adequate answer space]

SECTION 3 — CHALLENGE (2–3 higher-order questions for stretch learners)
[Open-ended or multi-step problems]

SUPPORT BOX
[Word bank, sentence starters, or diagram the learner can refer to]

TEACHER NOTES
Differentiation: [one short paragraph — how to adapt for foundation/stretch learners]
Answer key: [provide answers or model responses for every question]

LANGUAGE RULES:
- Learner-facing instructions: max 12 words per step
- No jargon without an immediate definition
- Neurodivergent-affirming framing throughout
- Do NOT stop early. Complete all sections."""

TEST_SYSTEM_PROMPT = """You are an expert inclusive assessment designer for neurodivergent \
learners aged 5–18. Create a complete, fair test a classroom teacher can administer immediately. \
Align question types with the topic and include accommodations. Never truncate.

OUTPUT STRUCTURE:
TEST TITLE
Subject / Topic / Grade: [as provided]
Total marks: [X]  |  Suggested time: [X minutes]

ACCOMMODATIONS NOTE (for teacher eyes only)
[One paragraph — extended time, read-aloud, reduced writing options, quiet workspace]

SECTION A — MULTIPLE CHOICE ([X] marks)
[4–6 questions with 4 options each; mark correct answer in teacher key]

SECTION B — SHORT ANSWER ([X] marks)
[4–6 questions; 1–3 sentences expected; mark allocation shown]

SECTION C — EXTENDED RESPONSE ([X] marks)
[1–2 questions requiring a paragraph or diagram; clear mark allocation]

MARKING RUBRIC
[Section-by-section mark allocation with brief descriptors for each mark band]

TEACHER ANSWER KEY
[Full model answers for all sections]

LANGUAGE RULES:
- Learner-facing questions: clear, unambiguous, one idea per question
- Avoid trick questions — test understanding, not reading stamina
- Do NOT stop early. Complete all sections."""

HOMEWORK_SYSTEM_PROMPT = """You are an expert inclusive education designer. Create a \
neurodivergent-friendly homework assignment that is engaging, achievable, and clearly \
explained. The task should be completable independently at home in 20–30 minutes. Never truncate.

OUTPUT STRUCTURE:
HOMEWORK TITLE
Subject / Topic / Grade: [as provided]
Estimated time: [20–30 minutes]

WHAT YOU NEED
[List of materials — household items only; no specialist equipment]

WHAT TO DO (step-by-step instructions)
Step 1: [max 12 words]
Step 2: [max 12 words]
[Continue until complete — typically 4–8 steps]

WHAT TO HAND IN / SHOW YOUR TEACHER
[Exactly what the learner should bring back — be specific]

SUPPORT TIPS FOR FAMILIES
[3–5 practical bullet points for parents/carers helping at home]

EXTENSION ACTIVITY (optional, for learners who finish early)
[One additional task that deepens understanding — 2–3 sentences]

TEACHER NOTES
Differentiation: [brief notes for adapting for foundation and stretch learners]
Marking guidance: [what a successful response looks like]

LANGUAGE RULES:
- Learner-facing steps: max 12 words each
- Family-facing tips: warm, accessible, assume no specialist knowledge
- Do NOT stop early. Complete all sections."""

# Map material type to its prompt — lesson plan is the default
_MATERIAL_PROMPTS: dict[str, str] = {
    "lesson_plan": LESSON_SYSTEM_PROMPT,
    "worksheet":   WORKSHEET_SYSTEM_PROMPT,
    "test":        TEST_SYSTEM_PROMPT,
    "homework":    HOMEWORK_SYSTEM_PROMPT,
}

# ─── Input Validation ─────────────────────────────────────────────────────────

FALLBACK_RESPONSE = (
    "I wasn't given enough detail to build a plan. "
    "Please provide a subject, topic, and grade level — for example: "
    "'Grade 4 Mathematics on fractions and equivalence'."
)


def _build_media_diagnostics(yt_diag: str, img_diag: str) -> list[str]:
    messages = []
    if "blocked" in (yt_diag, img_diag):
        return ["Video and image suggestions were skipped — this topic is outside the assistant's supported scope."]
    if yt_diag not in ("api_ok", "search_fallback"):
        messages.append(f"YouTube search unavailable ({yt_diag}) — showing search-page links instead.")
    elif yt_diag == "search_fallback":
        messages.append("Tip: add a YOUTUBE_API_KEY for curated, verified video results.")
    if img_diag == "no_key":
        messages.append("AI image generation requires GEMINI_API_KEY to be configured.")
    elif img_diag == "sdk_missing":
        messages.append("AI image generation unavailable — google-genai package not installed.")
    elif img_diag == "billing_disabled":
        messages.append("AI image generation unavailable — billing is not enabled on the Gemini API key.")
    elif img_diag == "quota_exceeded":
        messages.append("AI image generation unavailable — Gemini quota exceeded. Try again later.")
    elif img_diag.startswith("model_not_found"):
        messages.append(f"AI image generation unavailable — {img_diag.split(':', 1)[-1].strip()}.")
    elif img_diag.startswith("model_error"):
        messages.append(f"AI image generation failed ({img_diag.split(':', 1)[-1].strip()[:80]}).")
    return messages


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

    difficulty = state.get("difficulty")
    if difficulty:
        notes.append(f"Difficulty level requested: {difficulty} — calibrate task complexity and scaffold depth accordingly.")

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
            "difficulty":     str,   # Optional — "Foundation" | "Intermediate" | "Advanced"
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
            "output":            FALLBACK_RESPONSE,
            "topic":             "",
            "status":            "no_input",
            "youtube_links":     [],
            "image_aids":        [],
            "media_diagnostics": [],
        }

    topic_raw = sanitize_input(user_input)

    # Prefer explicit state fields; fall back to parsing the free-text input
    grade         = state.get("grade", "")         or _extract_field(user_input, "grade")
    subject       = state.get("subject", "")       or _extract_field(user_input, "subject")
    topic         = state.get("topic", "")         or _extract_field(user_input, "topic") or topic_raw
    material_type = (state.get("material_type") or "lesson_plan").lower().replace(" ", "_")

    system_prompt = _MATERIAL_PROMPTS.get(material_type, LESSON_SYSTEM_PROMPT)
    context_note  = build_context_note(state)
    language_note = get_language_instruction(state)
    llm           = get_llm()

    if llm is None:
        return {
            "output":            "GEMINI_API_KEY is missing. Add it to your environment before running chat requests.",
            "topic":             topic,
            "status":            "error",
            "youtube_links":     [],
            "image_aids":        [],
            "media_diagnostics": ["AI assistant unavailable — GEMINI_API_KEY not configured."],
        }

    user_message = (
        f"Please create a complete Assessment and Pedagogical Plan for the following:\n\n"
        f"REQUEST: {topic_raw}"
        f"{context_note}\n\n"
        f"Important: complete every section of the plan without stopping early."
    )

    # ── Run LLM, YouTube, and image generation concurrently ───────────────────
    def _call_llm() -> str:
        resp = llm.invoke([
            SystemMessage(content=system_prompt + language_note),
            HumanMessage(content=user_message),
        ])
        return resp.content.strip()

    with ThreadPoolExecutor(max_workers=3) as pool:
        text_future: Future[str] = pool.submit(_call_llm)
        yt_future: Future[tuple] = pool.submit(
            build_lesson_youtube_links, topic, subject, grade
        )
        img_future: Future[tuple] = pool.submit(
            generate_image_aids, topic, subject, grade, "lesson"
        )

        try:
            output_text = text_future.result()
        except Exception as exc:
            logger.error("Lesson planner LLM call failed: %s", exc)
            output_text = "The AI assistant encountered an error generating the lesson plan. Please try again."

        try:
            youtube_links, yt_diag = yt_future.result()
        except Exception as exc:
            logger.warning("YouTube future failed: %s", exc)
            youtube_links, yt_diag = [], f"api_error:{exc}"

        try:
            image_aids, img_diag = img_future.result()
        except Exception as exc:
            logger.warning("Image generation future failed: %s", exc)
            image_aids, img_diag = [], f"model_error:{exc}"

    media_diagnostics = _build_media_diagnostics(yt_diag, img_diag)

    return {
        "output":            output_text,
        "topic":             topic,
        "status":            "ok",
        "youtube_links":     youtube_links,
        "image_aids":        image_aids,
        "media_diagnostics": media_diagnostics,
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
