-- Create google_calendar_tokens so the Express backend can store calendar OAuth tokens
-- without depending on the Python agent's init function having run first.
-- The 20260620_add_gmail_email_to_calendar_tokens migration uses ADD COLUMN IF NOT EXISTS,
-- so it is safe to run after this table is created with gmail_email already included.

CREATE TABLE IF NOT EXISTS google_calendar_tokens (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    gmail_email   TEXT,
    access_token  TEXT NOT NULL,
    refresh_token TEXT,
    token_uri     TEXT,
    scopes        TEXT[],
    expiry        TIMESTAMPTZ,
    updated_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
