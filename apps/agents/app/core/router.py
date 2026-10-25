import logging
from typing import Any, Iterator, Optional
from app.core.supervisor import supervisor_agent
from app.core.guardrails import check_input, check_output
from app.core import memory_tools
from app.agents.general_agent import general_agent, stream_general_agent, get_llm as _general_llm
from app.agents.lesson_planer_agent import lesson_planner_agent
from app.agents.Multimodal_agent import multimodal_agent
from app.agents.scheduling_agent import scheduling_agent
from app.agents.visual_support_agent import visual_support_agent
from app.agents.analytics_agent import analytics_agent
from app.agents.rag_agent import rag_agent
from app.agents.parent_comm_agent import parent_comm_agent
from app.agents.support_agent import support_agent
from app.agents.ngo_match_agent import ngo_match_agent

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
    # Only reachable through tool_hint (learner support requests); the supervisor
    # never chooses it because it needs structured learner context.
    "support":    support_agent,
    "ngo":        ngo_match_agent,
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
            return {**state, "rag_context": rag_output, "rag_sources": rag_result.get("sources", [])}
        logger.warning("RAG enrichment returned empty output despite status='ok'")
    else:
        logger.warning(
            "RAG enrichment failed (status=%s): %s",
            rag_result.get("status"),
            rag_result.get("output", ""),
        )
    return state


def general_llm_available() -> bool:
    return _general_llm() is not None


def _prepare(user_input: str, thread_id: str, tool_hint: Optional[str], fields: dict) -> tuple[dict | None, dict, bool]:
    """
    Guardrails, state and memory shared by the normal and streaming paths.
    Returns (early_result, state, use_memory); early_result is set when no agent
    needs to run (blocked input or a 'remember ...' command).
    """
    guard = check_input(user_input)
    if guard.blocked:
        return {"text": guard.reason, "youtube_links": [], "image_aids": [], "media_diagnostics": []}, {}, False

    state = {
        "input":         guard.cleaned,
        "thread_id":     thread_id,
        "learner_name":  fields.get("learner_name") or "",
        "records":       fields.get("records") or [],
        "language_pref": fields.get("language_pref") or "en",
        "grade":         fields.get("grade") or "",
        "subject":       fields.get("subject") or "",
        "topic":         fields.get("topic") or "",
        "support_need":  fields.get("support_need") or "",
        "difficulty":    fields.get("difficulty") or "",
        "material_type": fields.get("material_type") or "",
        "communication_type": fields.get("communication_type") or "",
        "request_type":  fields.get("request_type") or "",
        "urgency":       fields.get("urgency") or "",
        "request_context": fields.get("request_context") or {},
    }

    # Memory is for open conversations with Thandi (no tool hint). Tool pages are
    # one-shot generators and must not be steered by earlier chat.
    use_memory = not tool_hint
    if use_memory:
        try:
            fact = memory_tools.parse_remember_command(guard.cleaned)
            if fact:
                saved = memory_tools.remember_fact(thread_id, fact)
                reply = f"Got it. I'll remember: {saved}." if saved else "There was nothing to remember."
                memory_tools.append_turns(thread_id, guard.cleaned, reply)
                return {
                    "text": reply,
                    "agent": "memory", "youtube_links": [], "image_aids": [], "media_diagnostics": [],
                }, state, use_memory
            state["history"] = memory_tools.recent_turns(thread_id)
            state["facts"] = memory_tools.get_user_facts(thread_id)
        except Exception as mem_exc:  # memory must never break the chat
            logger.warning("Memory lookup failed: %s", mem_exc)
    return None, state, use_memory


def _route(state: dict, tool_hint: Optional[str]) -> tuple[str, dict]:
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
    return decision, state


def _finish(result: dict, state: dict, decision: str, use_memory: bool) -> dict:
    text = check_output(result.get("output", ""))
    # Error messages are not part of the conversation worth remembering.
    if use_memory and text and result.get("status") != "error":
        try:
            memory_tools.append_turns(state["thread_id"], state["input"], text)
        except Exception as mem_exc:
            logger.warning("Memory save failed: %s", mem_exc)
    return {
        "text":              text,
        "agent":             decision,
        "youtube_links":     result.get("youtube_links", []),
        "image_aids":        result.get("image_aids", []),
        "media_diagnostics": result.get("media_diagnostics", []),
        "analytics":         result.get("analytics") or None,
        "sources":           result.get("sources") or state.get("rag_sources", []),
        "matches":           result.get("matches", []),
        "pending_action":    result.get("pending_action"),
        "error":             result.get("status") == "error",
    }


def _failure(exc: Exception, thread_id: str) -> dict:
    logger.exception("Agent pipeline failed (thread=%s): %s", thread_id, exc)
    err = str(exc)
    if "api" in err.lower() or "connect" in err.lower() or "key" in err.lower():
        return {"text": "The AI service is temporarily unavailable. Please check your API keys and try again.", "youtube_links": [], "image_aids": [], "media_diagnostics": [], "error": True}
    return {"text": "An unexpected error occurred. Please try again.", "youtube_links": [], "image_aids": [], "media_diagnostics": [], "error": True}


def run_multi_agent(user_input: str, thread_id: str, tool_hint: Optional[str] = None, **fields: Any) -> dict:
    early, state, use_memory = _prepare(user_input, thread_id, tool_hint, fields)
    if early is not None:
        return early
    try:
        decision, state = _route(state, tool_hint)
        agent_fn = AGENT_MAP.get(decision, general_agent)
        return _finish(agent_fn(state), state, decision, use_memory)
    except Exception as exc:
        return _failure(exc, thread_id)


def stream_multi_agent(user_input: str, thread_id: str, tool_hint: Optional[str] = None, **fields: Any) -> Iterator[dict]:
    """
    Same pipeline as run_multi_agent, yielding events for server-sent events:
    {"type": "token", "text": ...} while the general agent writes, then one
    {"type": "done", **response}. Other agents produce structured output, so they
    send a single "done" event. If the finished text fails the output guardrail,
    "done" carries the safe replacement and "replace": True.
    """
    early, state, use_memory = _prepare(user_input, thread_id, tool_hint, fields)
    if early is not None:
        yield {"type": "done", **early}
        return
    try:
        decision, state = _route(state, tool_hint)
        # Without a model there is nothing to stream; the normal path returns the error.
        if decision != "general" or not general_llm_available():
            agent_fn = AGENT_MAP.get(decision, general_agent)
            yield {"type": "done", **_finish(agent_fn(state), state, decision, use_memory)}
            return
        parts: list[str] = []
        for piece in stream_general_agent(state):
            parts.append(piece)
            yield {"type": "token", "text": piece}
        raw = "".join(parts).strip()
        final = _finish({"output": raw, "status": "ok"}, state, decision, use_memory)
        yield {"type": "done", **final, "replace": final["text"] != raw}
    except Exception as exc:
        yield {"type": "done", **_failure(exc, thread_id), "replace": True}
