-- Accounts created before email verification existed never received a valid
-- verification flow. Grandfather them so the new login gate does not lock out
-- existing teachers.
UPDATE users
SET email_verified = true
WHERE email_verified = false
  AND created_at < TIMESTAMP '2026-06-23 00:00:00';
