import os
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[4] / ".env")


def _connect_kwargs() -> dict[str, Any]:
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return {"dsn": database_url}

    return {
        "host": os.getenv("DB_HOST", "localhost"),
        "port": int(os.getenv("DB_PORT", "5432")),
        "user": os.getenv("DB_USER"),
        "password": os.getenv("DB_PASSWORD"),
        "dbname": os.getenv("DB_NAME"),
    }


@contextmanager
def get_connection():
    kwargs = _connect_kwargs()
    dsn = kwargs.pop("dsn", None)
    connection = psycopg2.connect(dsn, **kwargs) if dsn else psycopg2.connect(**kwargs)
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def init_calendar_token_store() -> None:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS google_calendar_tokens (
                    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                    gmail_email TEXT,
                    access_token TEXT NOT NULL,
                    refresh_token TEXT,
                    token_uri TEXT NOT NULL DEFAULT 'https://oauth2.googleapis.com/token',
                    scopes TEXT[] NOT NULL DEFAULT ARRAY['https://www.googleapis.com/auth/calendar'],
                    expiry TIMESTAMPTZ,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            # Add gmail_email column to existing tables that were created without it
            cursor.execute(
                """
                ALTER TABLE google_calendar_tokens
                ADD COLUMN IF NOT EXISTS gmail_email TEXT
                """
            )


def get_calendar_token(thread_id: str) -> dict[str, Any] | None:
    if not str(thread_id).isdigit():
        return None

    init_calendar_token_store()
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT access_token, refresh_token, token_uri, scopes, expiry, gmail_email
                FROM google_calendar_tokens
                WHERE user_id = %s
                """,
                (int(thread_id),),
            )
            row = cursor.fetchone()

    if row is None:
        return None

    access_token, refresh_token, token_uri, scopes, expiry, gmail_email = row
    return {
        "token": access_token,
        "refresh_token": refresh_token,
        "token_uri": token_uri,
        "scopes": scopes or ["https://www.googleapis.com/auth/calendar"],
        "expiry": expiry.isoformat() if expiry else None,
        "gmail_email": gmail_email,
    }


def save_calendar_token(
    user_id: int,
    gmail_email: str,
    access_token: str,
    refresh_token: str | None,
    expiry: datetime | None,
    token_uri: str = "https://oauth2.googleapis.com/token",
    scopes: list[str] | None = None,
) -> None:
    if scopes is None:
        scopes = ["https://www.googleapis.com/auth/calendar"]

    if expiry and expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)

    init_calendar_token_store()
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO google_calendar_tokens
                    (user_id, gmail_email, access_token, refresh_token, token_uri, scopes, expiry, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id) DO UPDATE SET
                    gmail_email    = EXCLUDED.gmail_email,
                    access_token   = EXCLUDED.access_token,
                    refresh_token  = COALESCE(EXCLUDED.refresh_token, google_calendar_tokens.refresh_token),
                    token_uri      = EXCLUDED.token_uri,
                    scopes         = EXCLUDED.scopes,
                    expiry         = EXCLUDED.expiry,
                    updated_at     = CURRENT_TIMESTAMP
                """,
                (
                    user_id,
                    gmail_email,
                    access_token,
                    refresh_token,
                    token_uri,
                    scopes,
                    expiry,
                ),
            )


def save_refreshed_calendar_token(thread_id: str, credentials) -> None:
    if not str(thread_id).isdigit():
        return

    expiry = credentials.expiry
    if expiry and expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE google_calendar_tokens
                SET access_token = %s,
                    refresh_token = COALESCE(%s, refresh_token),
                    expiry = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = %s
                """,
                (
                    credentials.token,
                    credentials.refresh_token,
                    expiry if isinstance(expiry, datetime) else None,
                    int(thread_id),
                ),
            )


def get_calendar_status(user_id: int) -> dict[str, Any] | None:
    """Returns connection status and gmail_email for a user, or None if not connected."""
    init_calendar_token_store()
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT gmail_email, updated_at
                FROM google_calendar_tokens
                WHERE user_id = %s
                """,
                (user_id,),
            )
            row = cursor.fetchone()

    if row is None:
        return None

    gmail_email, updated_at = row
    return {
        "connected": True,
        "gmail_email": gmail_email,
        "connected_at": updated_at.isoformat() if updated_at else None,
    }
