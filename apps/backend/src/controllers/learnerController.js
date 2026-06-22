const pool = require('../config/database');
const crypto = require('crypto');

// Get all learners for the logged-in teacher
const getLearners = async (req, res) => {
    const teacherId = req.user.id;
    try {
        const result = await pool.query(`
            SELECT id, anonymous_id, profile_data, created_at, updated_at
            FROM learner_profiles
            WHERE teacher_id = $1
            ORDER BY created_at DESC
        `, [teacherId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch learners' });
    }
};

// Create a new learner (from CSV upload)
const createLearner = async (req, res) => {
    const teacherId = req.user.id;
    const { anonymous_id, profile_data } = req.body;
    const anonymousId = typeof anonymous_id === 'string' ? anonymous_id.trim() : '';
    if (!anonymousId) return res.status(400).json({ error: 'anonymous_id required' });
    if (anonymousId.length > 100) {
        return res.status(400).json({ error: 'anonymous_id must be 100 characters or fewer' });
    }
    try {
        const result = await pool.query(`
            INSERT INTO learner_profiles (teacher_id, anonymous_id, profile_data)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [teacherId, anonymousId, profile_data || {}]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'A learner with this anonymous ID already exists' });
        }
        res.status(500).json({ error: 'Failed to create learner' });
    }
};

// Bulk insert learners (from CSV)
const bulkCreateLearners = async (req, res) => {
    const teacherId = req.user.id;
    const learners = req.body.learners;
    if (!Array.isArray(learners)) return res.status(400).json({ error: 'learners array required' });
    if (learners.length === 0 || learners.length > 1000) {
        return res.status(400).json({ error: 'Upload between 1 and 1000 learner rows at a time' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let insertedCount = 0;
        for (const [index, learner] of learners.entries()) {
            const anonymousId =
                learner.anonymous_id ||
                learner.anonymousId ||
                learner['Anonymous ID'] ||
                learner.learner_id ||
                `LEARNER-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

            if (String(anonymousId).trim().length > 100) {
                throw new Error(`Learner row ${index + 1} has an anonymous ID longer than 100 characters`);
            }

            const profileData = learner.profile_data || (() => {
                const normalized = { ...learner };
                delete normalized.anonymous_id;
                delete normalized.anonymousId;
                delete normalized['Anonymous ID'];
                delete normalized.learner_id;
                return normalized;
            })();

            const insertResult = await client.query(`
                INSERT INTO learner_profiles (teacher_id, anonymous_id, profile_data)
                VALUES ($1, $2, $3)
                ON CONFLICT ON CONSTRAINT learner_profiles_teacher_anonymous_unique DO NOTHING
            `, [teacherId, String(anonymousId).trim(), profileData || {}]);
            insertedCount += insertResult.rowCount;
        }
        await client.query('COMMIT');
        res.status(201).json({ message: `${insertedCount} learners uploaded` });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => null);
        console.error(err);
        const validationMessage =
            typeof err.message === 'string' && err.message.startsWith('Learner row ')
                ? err.message
                : null;
        res.status(validationMessage ? 400 : 500).json({
            error: validationMessage || 'Bulk upload failed',
        });
    } finally {
        client.release();
    }
};

// Sensory logs
const getSensoryLogs = async (req, res) => {
    const { learnerId } = req.params;
    const teacherId = req.user.id;
    try {
        const result = await pool.query(`
            SELECT id, log_data, logged_at
            FROM sensory_toolkit_logs
            WHERE learner_id = $1 AND teacher_id = $2
            ORDER BY logged_at DESC
        `, [learnerId, teacherId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch sensory logs' });
    }
};

const createSensoryLog = async (req, res) => {
    const { learnerId } = req.params;
    const teacherId = req.user.id;
    const { behavior, trigger, response, notes } = req.body;
    const logData = { behavior, trigger, response, notes };
    try {
        const insertResult = await pool.query(`
            INSERT INTO sensory_toolkit_logs (learner_id, teacher_id, log_data)
            SELECT lp.id, $2, $3
            FROM learner_profiles lp
            WHERE lp.id = $1 AND lp.teacher_id = $2
            RETURNING id
        `, [learnerId, teacherId, logData]);
        if (insertResult.rows.length === 0) {
            return res.status(404).json({ error: 'Learner not found' });
        }
        // Log activity
        await pool.query(`
            INSERT INTO activities (teacher_id, activity_type, description)
            VALUES ($1, $2, $3)
        `, [teacherId, 'sensory_log', `Logged sensory behavior for learner ${learnerId}`]);
        res.status(201).json({ message: 'Log saved' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save log' });
    }
};

// Get progress records for a specific learner
const getProgress = async (req, res) => {
    const { learnerId } = req.params;
    const teacherId = req.user.id;
    try {
        const result = await pool.query(`
            SELECT id, progress_data, recorded_at
            FROM learner_progress
            WHERE learner_id = $1 AND teacher_id = $2
            ORDER BY recorded_at DESC
        `, [learnerId, teacherId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch progress records' });
    }
};

// Create a new progress record
const createProgress = async (req, res) => {
    const { learnerId } = req.params;
    const teacherId = req.user.id;
    const {
        area,
        level,
        notes,
        achievements,
        engagementLevel,
        engagementDescription,
        attendance,
        taskCompletionLevel,
        taskCompletionDescription,
        aiSuggestions,
    } = req.body;
    const progressData = {
        area,
        level,
        notes,
        achievements,
        engagementLevel,
        engagementDescription,
        attendance,
        taskCompletionLevel,
        taskCompletionDescription,
        aiSuggestions,
    };
    if (!area || !level) {
        return res.status(400).json({ error: 'Area and level are required' });
    }
    try {
        const insertResult = await pool.query(`
            INSERT INTO learner_progress (learner_id, teacher_id, progress_data)
            SELECT lp.id, $2, $3
            FROM learner_profiles lp
            WHERE lp.id = $1 AND lp.teacher_id = $2
            RETURNING id
        `, [learnerId, teacherId, progressData]);
        if (insertResult.rows.length === 0) {
            return res.status(404).json({ error: 'Learner not found' });
        }
        // Log activity
        await pool.query(`
            INSERT INTO activities (teacher_id, activity_type, description)
            VALUES ($1, $2, $3)
        `, [teacherId, 'progress_update', `Updated progress for learner ${learnerId}`]);
        res.status(201).json({ message: 'Progress saved' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save progress' });
    }
};

module.exports = {
    getLearners,
    createLearner,
    bulkCreateLearners,
    getSensoryLogs,
    createSensoryLog,
    getProgress,
    createProgress,
};
