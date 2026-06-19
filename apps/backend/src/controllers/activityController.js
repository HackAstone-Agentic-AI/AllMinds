const pool = require('../config/database');

const TASK_STATUSES = ['pending', 'in_progress', 'completed'];
const TASK_PRIORITIES = ['low', 'medium', 'high'];

const getRecentActivities = async (req, res) => {
    const teacherId = req.user.id;

    try {
        const result = await pool.query(
            `
                SELECT id, activity_type, description, created_at
                FROM activities
                WHERE teacher_id = $1
                ORDER BY created_at DESC
                LIMIT 8
            `,
            [teacherId]
        );

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch activities' });
    }
};

const getLessonPlans = async (req, res) => {
    const teacherId = req.user.id;

    try {
        const result = await pool.query(
            `
                SELECT id, title, content, created_at
                FROM lesson_plans
                WHERE teacher_id = $1
                ORDER BY created_at DESC
            `,
            [teacherId]
        );

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch lesson plans' });
    }
};

const getTasks = async (req, res) => {
    const teacherId = req.user.id;

    try {
        const result = await pool.query(
            `
                SELECT id, teacher_id, title, description, status, priority, due_date, created_at, updated_at
                FROM teacher_tasks
                WHERE teacher_id = $1
                ORDER BY
                    CASE status
                        WHEN 'pending' THEN 0
                        WHEN 'in_progress' THEN 1
                        WHEN 'completed' THEN 2
                        ELSE 3
                    END,
                    due_date ASC NULLS LAST,
                    created_at DESC
            `,
            [teacherId]
        );

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
};

const createTask = async (req, res) => {
    const teacherId = req.user.id;
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const description =
        typeof req.body.description === 'string' ? req.body.description.trim() : '';
    const status = req.body.status || 'pending';
    const priority = req.body.priority || 'medium';
    const dueDate = req.body.due_date || null;

    if (!title) {
        return res.status(400).json({ error: 'Task title is required' });
    }

    if (!TASK_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Invalid task status' });
    }

    if (!TASK_PRIORITIES.includes(priority)) {
        return res.status(400).json({ error: 'Invalid task priority' });
    }

    try {
        const result = await pool.query(
            `
                INSERT INTO teacher_tasks (teacher_id, title, description, status, priority, due_date)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, teacher_id, title, description, status, priority, due_date, created_at, updated_at
            `,
            [teacherId, title, description || null, status, priority, dueDate]
        );

        await pool.query(
            `
                INSERT INTO activities (teacher_id, activity_type, description)
                VALUES ($1, $2, $3)
            `,
            [teacherId, 'task_created', `Created task "${title}"`]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create task' });
    }
};

const updateTask = async (req, res) => {
    const teacherId = req.user.id;
    const taskId = req.params.taskId;
    const updates = {};

    if (typeof req.body.title === 'string') {
        updates.title = req.body.title.trim();
    }
    if (typeof req.body.description === 'string') {
        updates.description = req.body.description.trim();
    }
    if (typeof req.body.status === 'string') {
        updates.status = req.body.status;
    }
    if (typeof req.body.priority === 'string') {
        updates.priority = req.body.priority;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'due_date')) {
        updates.due_date = req.body.due_date || null;
    }

    if (updates.title === '') {
        return res.status(400).json({ error: 'Task title cannot be empty' });
    }

    if (updates.status && !TASK_STATUSES.includes(updates.status)) {
        return res.status(400).json({ error: 'Invalid task status' });
    }

    if (updates.priority && !TASK_PRIORITIES.includes(updates.priority)) {
        return res.status(400).json({ error: 'Invalid task priority' });
    }

    const fields = [];
    const values = [teacherId, taskId];
    let paramIndex = values.length + 1;

    Object.entries(updates).forEach(([key, value]) => {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex += 1;
    });

    if (fields.length === 0) {
        return res.status(400).json({ error: 'No valid task fields were provided' });
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');

    try {
        const result = await pool.query(
            `
                UPDATE teacher_tasks
                SET ${fields.join(', ')}
                WHERE teacher_id = $1 AND id = $2
                RETURNING id, teacher_id, title, description, status, priority, due_date, created_at, updated_at
            `,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        await pool.query(
            `
                INSERT INTO activities (teacher_id, activity_type, description)
                VALUES ($1, $2, $3)
            `,
            [
                teacherId,
                'task_updated',
                `Updated task "${result.rows[0].title}" to ${result.rows[0].status.replace('_', ' ')}`,
            ]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update task' });
    }
};

module.exports = {
    createTask,
    getLessonPlans,
    getRecentActivities,
    getTasks,
    updateTask,
};
