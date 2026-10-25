-- One row per successful AI request, used for the teacher's impact summary
-- (what was generated, in which languages). Stores no prompt or response text.
CREATE TABLE IF NOT EXISTS ai_usage (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tool VARCHAR(30) NOT NULL,
    language_pref VARCHAR(10) NOT NULL DEFAULT 'en',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_teacher ON ai_usage(teacher_id, created_at);
