"""
Deterministic extraction of {title, date, start time, duration} from a teacher's
calendar request such as "schedule Grade 3 maths on Friday at 9am for 45 minutes".

Rules that avoid the old failure modes:
- A bare number is never a time ("Grade 3" stays in the title). A time needs am/pm,
  a colon (09:30), the word "at" (at 9), or noon/midday.
- Days: today, tomorrow, day after tomorrow, weekday names (this/next), and explicit
  dates (2026-10-31, 31/10, 31 October, October 31).
- Matched date, time and duration phrases are removed from the title.
"""
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta

WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august",
          "september", "october", "november", "december"]
_MONTH_RE = "|".join([m for m in MONTHS] + [m[:3] for m in MONTHS])

COMMAND_PREFIXES = [
    "please", "can you", "could you", "schedule", "book", "create an event", "create event",
    "add an event", "add event", "set up", "put", "add", "remind me to", "remind me",
    "create calendar event",
]
TRAILING_FILLERS = ["on my calendar", "to my calendar", "in my calendar", "to the calendar", "on the calendar"]

DEFAULT_DURATION_MIN = 60


@dataclass
class ParsedEvent:
    title: str
    date: date
    start: str | None          # "HH:MM", None when no time was given
    duration_minutes: int
    date_was_explicit: bool

    def as_dict(self) -> dict:
        return {
            "title": self.title,
            "date": self.date.isoformat(),
            "start_time": self.start,
            "duration_minutes": self.duration_minutes,
        }


def _month_index(token: str) -> int:
    token = token.lower()[:3]
    for i, month in enumerate(MONTHS):
        if month.startswith(token):
            return i + 1
    raise ValueError(token)


def _next_year_if_past(candidate: date, today: date) -> date:
    return candidate if candidate >= today else candidate.replace(year=candidate.year + 1)


def _extract_date(text: str, today: date) -> tuple[date, bool, str]:
    """Returns (date, explicit, text_without_date_phrase)."""
    patterns: list[tuple[str, callable]] = [
        (r"\bday after tomorrow\b", lambda m: today + timedelta(days=2)),
        (r"\btomorrow\b", lambda m: today + timedelta(days=1)),
        (r"\btoday\b|\btonight\b", lambda m: today),
        (r"\b(\d{4})-(\d{2})-(\d{2})\b",
         lambda m: date(int(m.group(1)), int(m.group(2)), int(m.group(3)))),
        (r"\b(\d{1,2})\s+(" + _MONTH_RE + r")\b",
         lambda m: _next_year_if_past(date(today.year, _month_index(m.group(2)), int(m.group(1))), today)),
        (r"\b(" + _MONTH_RE + r")\s+(\d{1,2})(?:st|nd|rd|th)?\b",
         lambda m: _next_year_if_past(date(today.year, _month_index(m.group(1)), int(m.group(2))), today)),
        (r"\b(\d{1,2})/(\d{1,2})\b",  # South African order: day/month
         lambda m: _next_year_if_past(date(today.year, int(m.group(2)), int(m.group(1))), today)),
        (r"\b(?:on\s+)?(next|this)?\s*(" + "|".join(WEEKDAYS) + r")\b",
         lambda m: _weekday(today, m.group(2), m.group(1))),
    ]
    for pattern, build in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if not match:
            continue
        try:
            found = build(match)
        except ValueError:
            continue  # e.g. 31/02
        stripped = (text[:match.start()] + " " + text[match.end():]).strip()
        return found, True, stripped
    return today, False, text


def _weekday(today: date, name: str, qualifier: str | None) -> date:
    target = WEEKDAYS.index(name.lower())
    days_ahead = (target - today.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7  # "Monday" said on a Monday means next Monday
    if qualifier and qualifier.lower() == "next" and days_ahead < 7:
        days_ahead += 7
    return today + timedelta(days=days_ahead)


def _extract_time(text: str) -> tuple[str | None, str]:
    patterns = [
        r"\b(?:at\s+)?(noon|midday)\b",
        r"\b(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)?\b",
        r"\b(?:at\s+)?(\d{1,2})\s*(am|pm)\b",
        r"\bat\s+(\d{1,2})\b(?!\s*(?:minutes?|mins?|hours?|hrs?))",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if not match:
            continue
        groups = match.groups()
        if groups[0].lower() in ("noon", "midday"):
            hour, minute = 12, 0
        else:
            hour = int(groups[0])
            minute = int(groups[1]) if len(groups) > 1 and groups[1] and groups[1].isdigit() else 0
            meridiem = next((g.lower() for g in groups[1:] if g and g.lower() in ("am", "pm")), None)
            if meridiem == "pm" and hour != 12:
                hour += 12
            elif meridiem == "am" and hour == 12:
                hour = 0
            elif meridiem is None and 1 <= hour <= 6 and "at" in match.group(0).lower() and ":" not in match.group(0):
                hour += 12  # "at 3" in a school context means 15:00
        if not (0 <= hour <= 23 and 0 <= minute <= 59):
            continue
        stripped = (text[:match.start()] + " " + text[match.end():]).strip()
        return f"{hour:02d}:{minute:02d}", stripped
    return None, text


def _extract_duration(text: str) -> tuple[int, str]:
    match = re.search(r"\bfor\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b", text, re.IGNORECASE)
    if not match:
        return DEFAULT_DURATION_MIN, text
    amount = float(match.group(1))
    minutes = int(amount * 60) if match.group(2).lower().startswith("h") else int(amount)
    minutes = max(5, min(minutes, 8 * 60))
    stripped = (text[:match.start()] + " " + text[match.end():]).strip()
    return minutes, stripped


def _clean_title(text: str) -> str:
    title = text.strip()
    lowered = title.lower()
    changed = True
    while changed:
        changed = False
        for prefix in COMMAND_PREFIXES:
            if lowered.startswith(prefix + " ") or lowered == prefix:
                title = title[len(prefix):].strip(" :.-,")
                lowered = title.lower()
                changed = True
    for filler in TRAILING_FILLERS:
        title = re.sub(re.escape(filler), " ", title, flags=re.IGNORECASE)
    title = re.sub(r"\b(on|at|for|from)\s*$", "", title.strip(), flags=re.IGNORECASE)
    title = re.sub(r"^(a|an|the)\s+", "", title.strip(), flags=re.IGNORECASE)
    title = re.sub(r"\s{2,}", " ", title).strip(" :.-,")
    if not title:
        return "New calendar event"
    return (title[0].upper() + title[1:])[:120]


def parse_event(text: str, now: datetime) -> ParsedEvent:
    today = now.date()
    remaining = text.strip()
    duration, remaining = _extract_duration(remaining)
    start, remaining = _extract_time(remaining)
    day, explicit, remaining = _extract_date(remaining, today)
    return ParsedEvent(
        title=_clean_title(remaining),
        date=day,
        start=start,
        duration_minutes=duration,
        date_was_explicit=explicit,
    )
