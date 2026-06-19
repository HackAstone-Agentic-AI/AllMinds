from typing import Any
from app.core.supervisor import supervisor_agent
from app.core.guardrails import check_input, check_output
from app.agents.general_agent import general_agent
from app.agents.lesson_planer_agent import lesson_planner_agent
from app.agents.Multimodal_agent import multimodal_agent
from app.agents.scheduling_agent import scheduling_agent
from app.agents.visual_support_agent import visual_support_agent
from app.agents.analytics_agent import analytics_agent

AGENT_MAP = {
    "general":    general_agent,
    "lesson":     lesson_planner_agent,
    "multimodal": multimodal_agent,
    "schedule":   scheduling_agent,
    "visual":     visual_support_agent,
    "analytics":  analytics_agent,
}


def run_multi_agent(
    user_input: str,
    thread_id: str = "default_user",
    learner_name: str = "",
    records: list[dict[str, Any]] = None,
) -> str:
    if records is None:
        records = []

    guard = check_input(user_input)
    if guard.blocked:
        return guard.reason

    state = {
        "input":        guard.cleaned,
        "thread_id":    thread_id,
        "learner_name": learner_name,
        "records":      records,
    }

    try:
        decision = supervisor_agent(state).get("decision", "general")
        agent_fn = AGENT_MAP.get(decision, general_agent)
        result = agent_fn(state)
        return check_output(result.get("output", ""))
    except Exception as exc:
        err = str(exc)
        if "api" in err.lower() or "connect" in err.lower() or "key" in err.lower():
            return "The AI service is temporarily unavailable. Please check your API keys and try again."
        return "An unexpected error occurred. Please try again."
