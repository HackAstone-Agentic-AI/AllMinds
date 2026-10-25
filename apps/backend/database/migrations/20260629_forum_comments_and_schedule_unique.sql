-- Group 5: Forum comments table
CREATE TABLE IF NOT EXISTS forum_comments (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
    teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_forum_comments_post_id ON forum_comments(post_id);

-- Group 1 (TC-SCH-006): Prevent duplicate schedule entries for same learner at the same time
-- PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS, so guard with pg_constraint.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_learner_schedule_time'
    ) THEN
        ALTER TABLE learner_schedule_items
            ADD CONSTRAINT uq_learner_schedule_time UNIQUE (learner_id, start_time);
    END IF;
END $$;
