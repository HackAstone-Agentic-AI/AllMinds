# app/core/memory_tools.py
"""
Thandi's memory, stored in SQLite.

- Short-term: the last few chat turns per teacher, so follow-ups like "make it
  shorter" have context.
- Long-term: facts the teacher explicitly asks Thandi to remember
  ("remember that my class is Grade 2").

Everything is keyed by the authenticated user id, PII is scrubbed before saving, and
forget_user() erases both tables for that teacher (POPIA right to erasure).
"""
import os
import re
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from langchain_core.tools import tool

from app.core.guardrails import scrub_pii

DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "thandi_memory.sqlite"
MAX_TURNS_KEPT = 20
MAX_FACTS = 30
MAX_TEXT = 2000

_REMEMBER_RE = re.compile(r"^\s*(?:please\s+)?remember(?:\s+that)?\s*[:,]?\s+(.+)$", re.IGNORECASE | re.DOTALL)


def _db_path() -> Path:
    return Path(os.getenv("MEMORY_DB_PATH", str(DEFAULT_DB_PATH)))


@contextmanager
def _connect():
    path = _db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), timeout=10, check_same_thread=False)
    try:
        conn.execute("PRAGMA journal_mode=WAL")  # safe with several Uvicorn workers
        yield conn
        conn.commit()
    finally:
        conn.close()


def setup_ltm_database():
    """Creates the memory tables if they don't exist."""
    with _connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS long_term_memory (
                user_id TEXT,
                fact TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, fact)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS conversation_turns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_turns_user ON conversation_turns(user_id, id)")


def _clean(text: str) -> str:
    return scrub_pii((text or "").strip())[:MAX_TEXT]


# 1. The Tool the AI can use to save facts
@tool
def save_user_fact(user_id: str, fact: str):
    """Use this tool to save important, permanent facts about the user (e.g., their name, what they are building, their preferences)."""
    remember_fact(user_id, fact)
    return f"Fact saved to long-term memory: {fact}"


def remember_fact(user_id: str, fact: str) -> str:
    cleaned = _clean(fact).rstrip(".")
    if not cleaned:
        return ""
    with _connect() as conn:
        conn.execute("INSERT OR IGNORE INTO long_term_memory (user_id, fact) VALUES (?, ?)", (str(user_id), cleaned))
        # Keep only the newest facts.
        conn.execute("""
            DELETE FROM long_term_memory WHERE user_id = ? AND rowid NOT IN (
                SELECT rowid FROM long_term_memory WHERE user_id = ? ORDER BY rowid DESC LIMIT ?
            )
        """, (str(user_id), str(user_id), MAX_FACTS))
    return cleaned


# 2. The utility we use to pull facts before the AI speaks
def get_user_facts(user_id: str) -> list[str]:
    """Retrieves all saved facts for a specific user."""
    with _connect() as conn:
        rows = conn.execute(
            "SELECT fact FROM long_term_memory WHERE user_id = ? ORDER BY rowid", (str(user_id),)
        ).fetchall()
    return [row[0] for row in rows]


def parse_remember_command(text: str) -> str | None:
    """'remember that my class is Grade 2' -> 'my class is Grade 2'."""
    match = _REMEMBER_RE.match(text or "")
    return match.group(1).strip() if match else None


def append_turns(user_id: str, user_text: str, assistant_text: str) -> None:
    with _connect() as conn:
        conn.executemany(
            "INSERT INTO conversation_turns (user_id, role, content) VALUES (?, ?, ?)",
            [(str(user_id), "user", _clean(user_text)), (str(user_id), "assistant", _clean(assistant_text))],
        )
        conn.execute("""
            DELETE FROM conversation_turns WHERE user_id = ? AND id NOT IN (
                SELECT id FROM conversation_turns WHERE user_id = ? ORDER BY id DESC LIMIT ?
            )
        """, (str(user_id), str(user_id), MAX_TURNS_KEPT))


def recent_turns(user_id: str, limit: int = 6) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT role, content FROM conversation_turns WHERE user_id = ? ORDER BY id DESC LIMIT ?",
            (str(user_id), limit),
        ).fetchall()
    return [{"role": role, "content": content} for role, content in reversed(rows)]


def forget_user(user_id: str) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM conversation_turns WHERE user_id = ?", (str(user_id),))
        conn.execute("DELETE FROM long_term_memory WHERE user_id = ?", (str(user_id),))


# Auto-run the setup when this file is imported!
setup_ltm_database()
