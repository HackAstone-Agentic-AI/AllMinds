from app.core.google_calendar_automation import run_calendar_automation


def scheduling_agent(state):
    """
    Backward-compatible wrapper around the direct Google Calendar automation.
    """
    user_input = state.get("input", "")
    return run_calendar_automation(user_input)
