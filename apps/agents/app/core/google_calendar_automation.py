import os
import pickle
import re
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/calendar"]
TOKEN_FILE = "token.pickle"
DEFAULT_CREDENTIALS_FILE = Path(__file__).resolve().parents[1] / "Credentials.json"
CREDENTIALS_FILE = os.getenv("GOOGLE_OAUTH_CLIENT_FILE", str(DEFAULT_CREDENTIALS_FILE))
TIMEZONE = os.getenv("APP_TIMEZONE", "Africa/Johannesburg")


def get_calendar_service():
    creds = None

    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, "rb") as token:
            creds = pickle.load(token)

    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())

    if not creds or not creds.valid:
        if not os.path.exists(CREDENTIALS_FILE):
            raise FileNotFoundError(
                f"OAuth client file not found: {CREDENTIALS_FILE}. "
                "Download your OAuth desktop app credentials from Google Cloud "
                "and place the file in your project root."
            )

        flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
        creds = flow.run_local_server(port=0)

        with open(TOKEN_FILE, "wb") as token:
            pickle.dump(creds, token)

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


def run_calendar_automation(user_input: str) -> dict:
    text = user_input.strip()
    if not text:
        return {
            "output": "No input was provided.",
            "status": "no_input",
        }

    try:
        service = get_calendar_service()
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
