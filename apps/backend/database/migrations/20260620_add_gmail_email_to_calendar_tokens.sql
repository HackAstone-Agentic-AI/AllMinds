-- Add gmail_email column to google_calendar_tokens to track which Google account is connected.
-- The column is nullable so existing rows are not broken.
ALTER TABLE google_calendar_tokens
    ADD COLUMN IF NOT EXISTS gmail_email TEXT;
