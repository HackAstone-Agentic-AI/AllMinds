from typing import Any
from app.core.supervisor import supervisor_agent
from app.core.guardrails import check_input, check_output
from app.agents.general_agent import general_agent
from app.agents.lesson_planer_agent import lesson_planner_agent
from app.agents.Multimodal_agent import multimodal_agent
from app.agents.scheduling_agent import scheduling_agent
from app.agents.visual_support_agent import visual_support_agent
from app.agents.analytics_agent import analytics_agent
from app.agents.rag_agent import rag_agent

AGENT_MAP = {
    "general":    general_agent,
    "lesson":     lesson_planner_agent,
    "multimodal": multimodal_agent,
    "schedule":   scheduling_agent,
    "visual":     visual_support_agent,
    "analytics":  analytics_agent,
    "rag":        rag_agent,
}


def _enrich_with_rag(state: dict) -> dict:
    """Query the RAG agent for DCAPS curriculum context and inject it into state."""
    rag_query = f"What does DCAPS say about {state['input']}?"
    rag_result = rag_agent({"input": rag_query})
    if rag_result.get("status") == "ok":
        state = {**state, "rag_context": rag_result.get("output", "")}
    return state


def run_multi_agent(
    user_input: str,
    thread_id: str = "default_user",
    learner_name: str = "",
    records: list[dict[str, Any]] = None,
    language_pref: str = "en",
) -> str:
    if records is None:
        records = []

    guard = check_input(user_input)
    if guard.blocked:
        return guard.reason

    state = {
        "input":         guard.cleaned,
        "thread_id":     thread_id,
        "learner_name":  learner_name,
        "records":       records,
        "language_pref": language_pref,
    }

    try:
        decision = supervisor_agent(state).get("decision", "general")

        if decision == "lesson":
            state = _enrich_with_rag(state)

        agent_fn = AGENT_MAP.get(decision, general_agent)
        result = agent_fn(state)
        return check_output(result.get("output", ""))
    except Exception as exc:
        err = str(exc)
        if "api" in err.lower() or "connect" in err.lower() or "key" in err.lower():
            return "The AI service is temporarily unavailable. Please check your API keys and try again."
        return "An unexpected error occurred. Please try again."
