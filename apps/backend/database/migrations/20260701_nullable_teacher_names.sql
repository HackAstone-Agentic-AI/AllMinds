-- OAuth and minimal sign-ups may not supply a first name or surname (for example a
-- single-word Google display name). NULL inserts used to violate NOT NULL and fail
-- the whole sign-in.
ALTER TABLE teacher_profiles ALTER COLUMN name DROP NOT NULL;
ALTER TABLE teacher_profiles ALTER COLUMN surname DROP NOT NULL;
