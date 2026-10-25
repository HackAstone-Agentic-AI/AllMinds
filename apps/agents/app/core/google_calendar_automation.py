import os
from datetime import datetime
from zoneinfo import ZoneInfo

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

from app.core.event_parser import parse_event
from app.core.calendar_token_store import (
    get_calendar_token,
    save_refreshed_calendar_token,
)

SCOPES = ["https://www.googleapis.com/auth/calendar"]
TIMEZONE = os.getenv("APP_TIMEZONE", "Africa/Johannesburg")


class CalendarNotConnectedError(Exception):
    pass


def get_calendar_service(thread_id: str):
    token_info = get_calendar_token(thread_id)
    if token_info is None:
        raise CalendarNotConnectedError(
            "Google Calendar is not connected for this account yet."
        )

    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")

    creds = Credentials(
        token=token_info["token"],
        refresh_token=token_info.get("refresh_token"),
        token_uri=token_info.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=client_id,
        client_secret=client_secret,
        scopes=token_info.get("scopes") or SCOPES,
    )
    if token_info.get("expiry"):
        creds.expiry = datetime.fromisoformat(token_info["expiry"])

    if creds.expired and creds.refresh_token:
        if not client_id or not client_secret:
            raise CalendarNotConnectedError(
                "Google Calendar token expired and GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET are not configured."
            )
        creds.refresh(Request())
        save_refreshed_calendar_token(thread_id, creds)

    if not creds.valid:
        raise CalendarNotConnectedError(
            "Google Calendar needs to be reconnected for this account."
        )

    return build("calendar", "v3", credentials=creds)


def is_schedule_query(user_input: str) -> bool:
    text = user_input.lower()
    phrases = [
        "what's my schedule",
        "whats my schedule",
        "show my schedule",
        "my schedule",
        "my events",
        "upcoming events",
        "upcoming tasks",
        "what do i have today",
        "what do i have tomorrow",
        "list my events",
        "show my calendar",
        "what is on my calendar",
        "what's on my calendar",
        "calendar today",
        "calendar tomorrow",
    ]
    return any(p in text for p in phrases)


def is_create_query(user_input: str) -> bool:
    text = user_input.lower()
    phrases = [
        "schedule ",
        "book ",
        "create event",
        "add event",
        "set up ",
        "remind me",
        "put this on my calendar",
        "add this to my calendar",
        "create calendar event",
        "add to calendar",
    ]
    return any(p in text for p in phrases)


def is_calendar_request(user_input: str) -> bool:
    text = user_input.strip().lower()
    if not text:
        return False

    explicit_calendar = any(
        phrase in text
        for phrase in (
            "calendar",
            "event",
            "events",
            "schedule ",
            "book ",
            "remind me",
        )
    )

    return explicit_calendar or is_schedule_query(text) or is_create_query(text)


def list_upcoming_events(service, max_results: int = 5) -> str:
    now = datetime.now(ZoneInfo(TIMEZONE)).isoformat()

    events_result = service.events().list(
        calendarId="primary",
        timeMin=now,
        maxResults=max_results,
        singleEvents=True,
        orderBy="startTime",
    ).execute()

    events = events_result.get("items", [])

    if not events:
        return "No upcoming events found."

    lines = ["Upcoming Google Calendar events:"]
    for event in events:
        start = event["start"].get("dateTime", event["start"].get("date", "Unknown start"))
        summary = event.get("summary", "Untitled event")
        lines.append(f"- {summary} at {start}")

    return "\n".join(lines)


def propose_event(user_input: str) -> dict:
    """
    Parse the request into an event and return it for the teacher to confirm in the UI.
    Nothing is written to the calendar until they press Confirm, so a misread date or
    time can be corrected first.
    """
    parsed = parse_event(user_input, datetime.now(ZoneInfo(TIMEZONE)))
    if parsed.start is None:
        return {
            "output": (
                f"What time should '{parsed.title}' start on {parsed.date.strftime('%A %d %B')}? "
                "Try for example 'at 9am' or 'at 14:30'."
            ),
            "status": "needs_time",
        }
    day_text = parsed.date.strftime("%A %d %B %Y")
    return {
        "output": (
            f"I can add '{parsed.title}' on {day_text} at {parsed.start} "
            f"for {parsed.duration_minutes} minutes. Please confirm below."
        ),
        "status": "needs_confirmation",
        "pending_action": {"type": "calendar_event", **parsed.as_dict()},
    }


def run_calendar_automation(user_input: str, thread_id: str) -> dict:
    text = user_input.strip()
    if not text:
        return {
            "output": "No input was provided.",
            "status": "no_input",
        }

    # Creating an event only needs a proposal; the confirmed event is written by the
    # backend's calendar endpoint, so no calendar connection is needed yet.
    if is_create_query(text) and not is_schedule_query(text):
        return propose_event(text)

    try:
        service = get_calendar_service(thread_id)
    except CalendarNotConnectedError as exc:
        return {
            "output": f"{exc} Please connect Google Calendar from your AllMinds account settings, then try again.",
            "status": "calendar_not_connected",
        }
    except Exception as exc:
        return {
            "output": f"Failed to connect to Google Calendar: {exc}",
            "status": "error",
        }

    try:
        if is_schedule_query(text):
            return {
                "output": list_upcoming_events(service),
                "status": "ok",
            }

        return {
            "output": (
                "I can add Google Calendar events or show upcoming events. "
                "Try 'schedule a maths lesson tomorrow at 9am' or 'what's on my calendar'."
            ),
            "status": "ok",
        }
    except Exception as exc:
        return {
            "output": f"Google Calendar automation failed: {exc}",
            "status": "error",
        }
