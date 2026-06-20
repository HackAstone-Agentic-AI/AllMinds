import os
import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

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


def clean_event_title(user_input: str) -> str:
    prefixes = [
        "schedule",
        "book",
        "create event",
        "add event",
        "set up",
        "put this on my calendar",
        "add this to my calendar",
        "create calendar event",
        "add to calendar",
        "remind me to",
        "remind me",
    ]
    title = user_input.strip()
    lowered = title.lower()

    for prefix in prefixes:
        if lowered.startswith(prefix):
            title = title[len(prefix):].strip(" :.-")
            break

    if not title:
        title = "New calendar event"

    return title[:120]


def parse_event_time(user_input: str):
    now = datetime.now(ZoneInfo(TIMEZONE))
    start_dt = now + timedelta(hours=1)
    start_dt = start_dt.replace(minute=0, second=0, microsecond=0)

    text = user_input.lower()

    if "tomorrow" in text:
        start_dt = (now + timedelta(days=1)).replace(hour=9, minute=0, second=0, microsecond=0)
    elif "today" in text:
        start_dt = now.replace(hour=max(now.hour + 1, 9), minute=0, second=0, microsecond=0)

    match = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b", text)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2) or 0)
        meridiem = match.group(3)

        if meridiem == "pm" and hour != 12:
            hour += 12
        elif meridiem == "am" and hour == 12:
            hour = 0

        if 0 <= hour <= 23 and 0 <= minute <= 59:
            start_dt = start_dt.replace(hour=hour, minute=minute)

    duration_hours = 1
    duration_match = re.search(r"\bfor\s+(\d+)\s*(hour|hours|hr|hrs|minute|minutes|min|mins)\b", text)
    if duration_match:
        amount = int(duration_match.group(1))
        unit = duration_match.group(2)
        if "min" in unit:
            end_dt = start_dt + timedelta(minutes=amount)
        else:
            end_dt = start_dt + timedelta(hours=amount)
        return start_dt, end_dt

    end_dt = start_dt + timedelta(hours=duration_hours)
    return start_dt, end_dt


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


def create_simple_event(service, user_input: str) -> str:
    start_dt, end_dt = parse_event_time(user_input)

    event = {
        "summary": clean_event_title(user_input),
        "start": {
            "dateTime": start_dt.isoformat(),
            "timeZone": TIMEZONE,
        },
        "end": {
            "dateTime": end_dt.isoformat(),
            "timeZone": TIMEZONE,
        },
    }

    created_event = service.events().insert(calendarId="primary", body=event).execute()

    created_summary = created_event.get("summary", "Untitled event")
    created_start = created_event["start"].get("dateTime", created_event["start"].get("date", "Unknown start"))

    return f"Google Calendar event '{created_summary}' scheduled for {created_start}."


def run_calendar_automation(user_input: str, thread_id: str) -> dict:
    text = user_input.strip()
    if not text:
        return {
            "output": "No input was provided.",
            "status": "no_input",
        }

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

        if is_create_query(text):
            return {
                "output": create_simple_event(service, text),
                "status": "ok",
            }

        return {
            "output": (
                "I can create Google Calendar events or show upcoming events. "
                "Try 'schedule a math lesson tomorrow at 9am' or 'what's on my calendar'."
            ),
            "status": "ok",
        }
    except Exception as exc:
        return {
            "output": f"Google Calendar automation failed: {exc}",
            "status": "error",
        }
