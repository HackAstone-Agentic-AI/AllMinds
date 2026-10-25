from datetime import datetime

import pytest

from app.core.event_parser import parse_event

NOW = datetime(2026, 10, 25, 10, 0)  # a Sunday


@pytest.mark.parametrize("text, title, date, start, minutes", [
    ("schedule Grade 3 maths tomorrow at 9am", "Grade 3 maths", "2026-10-26", "09:00", 60),
    ("schedule a maths lesson on Friday at 9:30 for 45 minutes", "Maths lesson", "2026-10-30", "09:30", 45),
    ("book parent meeting next Monday at 2pm for 1 hour", "Parent meeting", "2026-11-02", "14:00", 60),
    ("remind me to print now/next boards at 3", "Print now/next boards", "2026-10-25", "15:00", 60),
    ("add Grade 4 reading group on 31 October at 10:00", "Grade 4 reading group", "2026-10-31", "10:00", 60),
    ("schedule IEP review 3/11 at noon", "IEP review", "2026-11-03", "12:00", 60),
    ("put sensory break on my calendar today at 11", "Sensory break", "2026-10-25", "11:00", 60),
])
def test_parse_event(text, title, date, start, minutes):
    parsed = parse_event(text, NOW).as_dict()
    assert parsed == {"title": title, "date": date, "start_time": start, "duration_minutes": minutes}


def test_bare_number_is_not_a_time():
    parsed = parse_event("schedule Grade 3 maths tomorrow", NOW)
    assert parsed.start is None
    assert parsed.title == "Grade 3 maths"
