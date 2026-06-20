from app.core.google_calendar_automation import run_calendar_automation


def scheduling_agent(state):
    user_input = state.get("input", "")
    thread_id = state.get("thread_id", "")
    return run_calendar_automation(user_input, thread_id)
