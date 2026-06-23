import logging
from typing import Any, Optional
from app.core.supervisor import supervisor_agent
from app.core.guardrails import check_input, check_output
from app.agents.general_agent import general_agent
from app.agents.lesson_planer_agent import lesson_planner_agent
from app.agents.Multimodal_agent import multimodal_agent
from app.agents.scheduling_agent import scheduling_agent
from app.agents.visual_support_agent import visual_support_agent
from app.agents.analytics_agent import analytics_agent
from app.agents.rag_agent import rag_agent
from app.agents.parent_comm_agent import parent_comm_agent

logger = logging.getLogger(__name__)

AGENT_MAP = {
    "general":    general_agent,
    "lesson":     lesson_planner_agent,
    "multimodal": multimodal_agent,
    "schedule":   scheduling_agent,
    "visual":     visual_support_agent,
    "analytics":  analytics_agent,
    "rag":        rag_agent,
    "parent":     parent_comm_agent,
}

# Single source of truth for valid tool hints — derived from AGENT_MAP so they
# stay in sync automatically. Import this in index.py for request validation.
VALID_TOOL_HINTS: frozenset[str] = frozenset(AGENT_MAP.keys())

# Trigger RAG enrichment only for lesson requests that plausibly reference the
# formal curriculum, avoiding an unnecessary LLM + vector-search call otherwise.
# Uses SA-curriculum-specific terms rather than common English words to minimise
# false positives (e.g. "outcome", "subject", "senior" were removed).
_CURRICULUM_KEYWORDS = frozenset([
    "grade", "phase", "curriculum", "dcaps", "caps", "foundation",
    "numeracy", "literacy", "life skills", "home language", "fal",
])


def _needs_rag_enrichment(user_input: str) -> bool:
    lower = user_input.lower()
    return any(kw in lower for kw in _CURRICULUM_KEYWORDS)


def _enrich_with_rag(state: dict) -> dict:
    """Query the RAG agent for DCAPS curriculum context and inject it into state."""
    user_input = state.get("input", "")
    if not user_input or not _needs_rag_enrichment(user_input):
        return state

    # Frame as a curriculum question for better vector retrieval.
    # Skip the wrapper when the input is already a question to avoid double-framing.
    if user_input.rstrip().endswith("?"):
        rag_query = user_input
    else:
        rag_query = f"What does DCAPS say about {user_input}?"

    rag_result = rag_agent({"input": rag_query})
    if rag_result.get("status") == "ok":
        rag_output = rag_result.get("output", "").strip()
        if rag_output:
            return {**state, "rag_context": rag_output}
        logger.warning("RAG enrichment returned empty output despite status='ok'")
    else:
        logger.warning(
            "RAG enrichment failed (status=%s): %s",
            rag_result.get("status"),
            rag_result.get("output", ""),
        )
    return state


def run_multi_agent(
    user_input: str,
    thread_id: str,
    learner_name: str = "",
    records: list[dict[str, Any]] = None,
    language_pref: str = "en",
    tool_hint: Optional[str] = None,
    grade: Optional[str] = None,
    subject: Optional[str] = None,
    topic: Optional[str] = None,
    support_need: Optional[str] = None,
    difficulty: Optional[str] = None,
    material_type: Optional[str] = None,
    communication_type: Optional[str] = None,
) -> dict:
    if records is None:
        records = []

    guard = check_input(user_input)
    if guard.blocked:
        return {"text": guard.reason, "youtube_links": [], "image_aids": [], "media_diagnostics": []}

    state = {
        "input":         guard.cleaned,
        "thread_id":     thread_id,
        "learner_name":  learner_name,
        "records":       records,
        "language_pref": language_pref,
        "grade":         grade or "",
        "subject":       subject or "",
        "topic":         topic or "",
        "support_need":  support_need or "",
        "difficulty":    difficulty or "",
        "material_type": material_type or "",
        "communication_type": communication_type or "",
    }

    try:
        # If the calling component explicitly names its tool, skip the LLM
        # classifier and route directly. Falls back to supervisor for unknown hints.
        if tool_hint and tool_hint in AGENT_MAP:
            decision = tool_hint
        else:
            decision = supervisor_agent(state).get("decision", "general")

        if decision == "lesson":
            try:
                state = _enrich_with_rag(state)
            except Exception as rag_exc:
                # Enrichment is best-effort; a failure must not prevent the lesson
                # plan from being generated.
                logger.warning("RAG enrichment raised unexpectedly: %s", rag_exc)

        agent_fn = AGENT_MAP.get(decision, general_agent)
        result = agent_fn(state)
        return {
            "text":              check_output(result.get("output", "")),
            "youtube_links":     result.get("youtube_links", []),
            "image_aids":        result.get("image_aids", []),
            "media_diagnostics": result.get("media_diagnostics", []),
        }
    except Exception as exc:
        err = str(exc)
        if "api" in err.lower() or "connect" in err.lower() or "key" in err.lower():
            return {"text": "The AI service is temporarily unavailable. Please check your API keys and try again.", "youtube_links": [], "image_aids": [], "media_diagnostics": []}
        return {"text": "An unexpected error occurred. Please try again.", "youtube_links": [], "image_aids": [], "media_diagnostics": []}
