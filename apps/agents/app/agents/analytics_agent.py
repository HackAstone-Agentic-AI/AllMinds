from app.core.analytics_automation import run_analytics_automation


def analytics_agent(state: dict) -> dict:
    """
    Backward-compatible wrapper around the direct analytics automation.
    """
    return run_analytics_automation(
        state.get("input", ""),
        learner_name=state.get("learner_name", ""),
        records=state.get("records", []),
    )
