CREATE TABLE IF NOT EXISTS learner_schedule_items (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    learner_id INTEGER NOT NULL REFERENCES learner_profiles(id) ON DELETE CASCADE,
    title VARCHAR(160) NOT NULL,
    start_time TIME NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_learner_schedule_items_teacher_learner
    ON learner_schedule_items(teacher_id, learner_id);

CREATE INDEX IF NOT EXISTS idx_learner_schedule_items_start_time
    ON learner_schedule_items(start_time);
