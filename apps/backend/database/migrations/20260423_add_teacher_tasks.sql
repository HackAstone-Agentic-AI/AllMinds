CREATE TABLE IF NOT EXISTS teacher_tasks (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    due_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_teacher_tasks_teacher ON teacher_tasks(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_tasks_status ON teacher_tasks(status);
CREATE INDEX IF NOT EXISTS idx_teacher_tasks_due_date ON teacher_tasks(due_date);
