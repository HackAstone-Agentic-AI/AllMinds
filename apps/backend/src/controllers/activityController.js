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
            `SELECT id, title, content, created_at
             FROM lesson_plans
             WHERE teacher_id = $1
             ORDER BY created_at DESC`,
            [teacherId]
        );

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch lesson plans' });
    }
};

const getLessonPlanById = async (req, res) => {
    const teacherId = req.user.id;
    const planId = Number(req.params.planId);

    if (!Number.isInteger(planId) || planId <= 0) {
        return res.status(400).json({ error: 'Invalid plan ID' });
    }

    try {
        const result = await pool.query(
            `SELECT id, title, content, created_at
             FROM lesson_plans
             WHERE id = $1 AND teacher_id = $2`,
            [planId, teacherId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Plan not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch plan' });
    }
};

const createLessonPlan = async (req, res) => {
    const teacherId = req.user.id;
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';

    if (!title || title.length > 255) {
        return res.status(400).json({ error: 'A plan title (max 255 characters) is required' });
    }
    if (!content) {
        return res.status(400).json({ error: 'Plan content is required' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO lesson_plans (teacher_id, title, content)
             VALUES ($1, $2, $3)
             RETURNING id, title, content, created_at`,
            [teacherId, title, content]
        );

        await pool.query(
            `INSERT INTO activities (teacher_id, activity_type, description)
             VALUES ($1, $2, $3)`,
            [teacherId, 'lesson_plan_created', `Saved assessment plan "${title}"`]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save plan' });
    }
};

const deleteLessonPlan = async (req, res) => {
    const teacherId = req.user.id;
    const planId = Number(req.params.planId);

    if (!Number.isInteger(planId) || planId <= 0) {
        return res.status(400).json({ error: 'Invalid plan ID' });
    }

    try {
        const result = await pool.query(
            `DELETE FROM lesson_plans WHERE id = $1 AND teacher_id = $2 RETURNING id`,
            [planId, teacherId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Plan not found' });
        }

        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete plan' });
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

const getScheduleItems = async (req, res) => {
    const teacherId = req.user.id;
    const learnerId = Number(req.query.learnerId);

    if (!Number.isInteger(learnerId) || learnerId <= 0) {
        return res.status(400).json({ error: 'A valid learnerId is required' });
    }

    try {
        const result = await pool.query(
            `
                SELECT si.id, si.teacher_id, si.learner_id, si.title,
                       to_char(si.start_time, 'HH24:MI') AS start_time,
                       si.notes, si.created_at, si.updated_at
                FROM learner_schedule_items si
                JOIN learner_profiles lp ON lp.id = si.learner_id
                WHERE si.teacher_id = $1 AND si.learner_id = $2 AND lp.teacher_id = $1
                ORDER BY si.start_time, si.created_at
            `,
            [teacherId, learnerId]
        );

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch schedule items' });
    }
};

const createScheduleItem = async (req, res) => {
    const teacherId = req.user.id;
    const learnerId = Number(req.body.learner_id);
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const startTime = typeof req.body.start_time === 'string' ? req.body.start_time.trim() : '';
    const notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : '';

    if (!Number.isInteger(learnerId) || learnerId <= 0) {
        return res.status(400).json({ error: 'A valid learner is required' });
    }
    if (!title || title.length > 160) {
        return res.status(400).json({ error: 'Title is required and must be 160 characters or fewer' });
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) {
        return res.status(400).json({ error: 'start_time must use HH:MM format' });
    }
    if (notes.length > 1000) {
        return res.status(400).json({ error: 'Notes must be 1000 characters or fewer' });
    }

    try {
        const result = await pool.query(
            `
                INSERT INTO learner_schedule_items
                    (teacher_id, learner_id, title, start_time, notes)
                SELECT $1, lp.id, $3, $4::time, $5
                FROM learner_profiles lp
                WHERE lp.id = $2 AND lp.teacher_id = $1
                RETURNING id, teacher_id, learner_id, title,
                          to_char(start_time, 'HH24:MI') AS start_time,
                          notes, created_at, updated_at
            `,
            [teacherId, learnerId, title, startTime, notes || null]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Learner not found' });
        }

        await pool.query(
            `INSERT INTO activities (teacher_id, activity_type, description)
             VALUES ($1, $2, $3)`,
            [teacherId, 'schedule_item_created', `Added "${title}" to a learner schedule`]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'A schedule item for this learner already exists at that time' });
        }
        console.error(err);
        res.status(500).json({ error: 'Failed to create schedule item' });
    }
};

// Group 2 (TC-SCH-004): Update an existing schedule item
const updateScheduleItem = async (req, res) => {
    const teacherId = req.user.id;
    const scheduleItemId = Number(req.params.scheduleItemId);

    if (!Number.isInteger(scheduleItemId) || scheduleItemId <= 0) {
        return res.status(400).json({ error: 'Invalid schedule item ID' });
    }

    const updates = {};
    if (typeof req.body.title === 'string') {
        const title = req.body.title.trim();
        if (!title || title.length > 160) {
            return res.status(400).json({ error: 'Title is required and must be 160 characters or fewer' });
        }
        updates.title = title;
    }
    if (typeof req.body.start_time === 'string') {
        const startTime = req.body.start_time.trim();
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) {
            return res.status(400).json({ error: 'start_time must use HH:MM format' });
        }
        updates.start_time = startTime;
    }
    if (typeof req.body.notes === 'string') {
        const notes = req.body.notes.trim();
        if (notes.length > 1000) {
            return res.status(400).json({ error: 'Notes must be 1000 characters or fewer' });
        }
        updates.notes = notes || null;
    }

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
    }

    const fields = [];
    const values = [teacherId, scheduleItemId];
    let paramIndex = values.length + 1;

    if (updates.title !== undefined) {
        fields.push(`title = $${paramIndex++}`);
        values.push(updates.title);
    }
    if (updates.start_time !== undefined) {
        fields.push(`start_time = $${paramIndex++}::time`);
        values.push(updates.start_time);
    }
    if (updates.notes !== undefined) {
        fields.push(`notes = $${paramIndex++}`);
        values.push(updates.notes);
    }
    fields.push('updated_at = CURRENT_TIMESTAMP');

    try {
        const result = await pool.query(
            `UPDATE learner_schedule_items
             SET ${fields.join(', ')}
             WHERE teacher_id = $1 AND id = $2
             RETURNING id, teacher_id, learner_id, title,
                       to_char(start_time, 'HH24:MI') AS start_time,
                       notes, created_at, updated_at`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Schedule item not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'A schedule item for this learner already exists at that time' });
        }
        console.error(err);
        res.status(500).json({ error: 'Failed to update schedule item' });
    }
};

const deleteScheduleItem = async (req, res) => {
    const teacherId = req.user.id;
    const scheduleItemId = Number(req.params.scheduleItemId);

    if (!Number.isInteger(scheduleItemId) || scheduleItemId <= 0) {
        return res.status(400).json({ error: 'Invalid schedule item ID' });
    }

    try {
        const result = await pool.query(
            `DELETE FROM learner_schedule_items
             WHERE id = $1 AND teacher_id = $2
             RETURNING id`,
            [scheduleItemId, teacherId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Schedule item not found' });
        }

        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete schedule item' });
    }
};

module.exports = {
    createLessonPlan,
    createScheduleItem,
    createTask,
    deleteLessonPlan,
    deleteScheduleItem,
    getLessonPlanById,
    getLessonPlans,
    getRecentActivities,
    getScheduleItems,
    getTasks,
    updateScheduleItem,
    updateTask,
};
