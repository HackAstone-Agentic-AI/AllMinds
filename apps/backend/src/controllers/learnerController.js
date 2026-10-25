const pool = require('../config/database');
const crypto = require('crypto');
const { findPii } = require('../utils/pii');

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

const MIN_RECORDS = 3;
const RECENT_RECORDS = 8;

const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

// Same support-priority formula as the analytics page: the average shortfall from
// 100% across engagement, task completion and attendance (each scaled 0-100).
const supportPriority = (records) => {
    const engagement = records.map((r) => Number(r.engagementLevel)).filter((v) => v > 0);
    const completion = records.map((r) => Number(r.taskCompletionLevel)).filter((v) => v > 0);
    const attendance = records
        .map((r) => String(r.attendance || '').toLowerCase())
        .filter((v) => v === 'present' || v === 'not present')
        .map((v) => (v === 'present' ? 1 : 0));
    const gaps = [];
    if (engagement.length) gaps.push(100 - (mean(engagement) / 5) * 100);
    if (completion.length) gaps.push(100 - (mean(completion) / 5) * 100);
    if (attendance.length) gaps.push(100 - mean(attendance) * 100);
    return {
        score: gaps.length ? mean(gaps) : null,
        engagement,
        attendanceRate: attendance.length ? Math.round(mean(attendance) * 100) : null,
    };
};

// Ranked list of learners who most need attention, with plain-language reasons.
const getAttentionList = async (req, res) => {
    const teacherId = req.user.id;
    try {
        const result = await pool.query(`
            SELECT lp.id, lp.anonymous_id, lp.profile_data,
                   COALESCE((
                       SELECT json_agg(p.progress_data ORDER BY p.recorded_at)
                       FROM (
                           SELECT progress_data, recorded_at FROM learner_progress
                           WHERE learner_id = lp.id ORDER BY recorded_at DESC LIMIT $2
                       ) p
                   ), '[]'::json) AS records,
                   (SELECT COUNT(*)::int FROM sensory_toolkit_logs s
                    WHERE s.learner_id = lp.id AND s.logged_at > CURRENT_TIMESTAMP - INTERVAL '14 days') AS recent_incidents
            FROM learner_profiles lp
            WHERE lp.teacher_id = $1
        `, [teacherId, RECENT_RECORDS]);

        const ranked = [];
        for (const row of result.rows) {
            if (row.records.length < MIN_RECORDS) continue;
            const { score, engagement, attendanceRate } = supportPriority(row.records);
            if (score === null) continue;
            const reasons = [];
            let total = score;
            if (engagement.length >= 4) {
                const half = Math.floor(engagement.length / 2);
                const drop = mean(engagement.slice(0, half)) - mean(engagement.slice(-half));
                if (drop >= 0.5) {
                    reasons.push(`Engagement dropped by ${drop.toFixed(1)} points`);
                    total += 10;
                }
            }
            if (attendanceRate !== null && attendanceRate < 80) reasons.push(`Attendance ${attendanceRate}%`);
            if (row.recent_incidents > 0) {
                reasons.push(`${row.recent_incidents} behaviour/sensory log(s) in 14 days`);
                total += 5 * Math.min(row.recent_incidents, 3);
            }
            if (score >= 40) reasons.unshift(`Support priority ${Math.round(score)}/100`);
            ranked.push({
                id: row.id,
                anonymous_id: row.anonymous_id,
                profile_data: row.profile_data,
                score: Math.round(total),
                band: score >= 70 ? 'High' : score >= 40 ? 'Moderate' : 'Low',
                reasons,
            });
        }
        ranked.sort((a, b) => b.score - a.score);
        res.json({ learners: ranked.slice(0, 5), minRecords: MIN_RECORDS });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to build the attention list' });
    }
};

const NAME_KEYS = ['pseudonym', 'preferredname', 'learnername', 'studentname', 'displayname',
    'fullname', 'name', 'firstname', 'givenname'];

// First non-empty name-like field, matching keys case- and punctuation-insensitively.
const learnerName = (profile) => {
    for (const [key, value] of Object.entries(profile || {})) {
        if (NAME_KEYS.includes(key.toLowerCase().replace(/[^a-z]/g, '')) && String(value ?? '').trim()) {
            return String(value).trim();
        }
    }
    return '';
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
        let piiValuesRemoved = 0;
        const invalidRows = [];
        for (const [index, learner] of learners.entries()) {
            const providedId = String(
                learner.anonymous_id || learner.anonymousId || learner['Anonymous ID'] || learner.learner_id || ''
            ).trim();
            // A record needs an ID or a name/pseudonym, otherwise nobody can tell who it is.
            if (!providedId && !learnerName(learner.profile_data || learner)) {
                invalidRows.push(index + 1);
                continue;
            }
            const anonymousId = providedId || `LEARNER-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

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

            // Server-side backstop for the browser's import preview: never store ID numbers,
            // e-mail addresses, phone numbers or street addresses in learner profiles.
            const safeProfile = {};
            for (const [key, value] of Object.entries(profileData || {})) {
                const hits = typeof value === 'string' ? findPii(value) : [];
                if (hits.some((hit) => hit !== "a child's full name")) {
                    piiValuesRemoved += 1;
                    continue;
                }
                safeProfile[key] = value;
            }

            const insertResult = await client.query(`
                INSERT INTO learner_profiles (teacher_id, anonymous_id, profile_data)
                VALUES ($1, $2, $3)
                ON CONFLICT ON CONSTRAINT learner_profiles_teacher_anonymous_unique DO NOTHING
            `, [teacherId, String(anonymousId).trim(), safeProfile]);
            insertedCount += insertResult.rowCount;
        }
        if (invalidRows.length === learners.length) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: 'No rows were uploaded: every row is missing a learner ID or name.',
                invalid_rows: invalidRows,
            });
        }
        await client.query('COMMIT');
        const skippedCount = learners.length - insertedCount - invalidRows.length;
        const parts = [`${insertedCount} learner${insertedCount !== 1 ? 's' : ''} uploaded`];
        if (skippedCount > 0) {
            parts.push(`${skippedCount} duplicate${skippedCount !== 1 ? 's' : ''} skipped`);
        }
        if (invalidRows.length > 0) {
            parts.push(`${invalidRows.length} row${invalidRows.length !== 1 ? 's' : ''} without a learner ID or name rejected`);
        }
        res.status(201).json({
            message: parts.join(', '),
            inserted: insertedCount,
            skipped: skippedCount,
            invalid_rows: invalidRows,
            pii_values_removed: piiValuesRemoved,
        });
    } catch (err) {
        await client.query('ROLLBACK').catch((rbErr) => console.error('Rollback error:', rbErr));
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
const LIKERT_VALUES = ['', '1', '2', '3', '4', '5'];
const ATTENDANCE_VALUES = ['', 'present', 'not present'];

const createProgress = async (req, res) => {
    const { learnerId } = req.params;
    const teacherId = req.user.id;
    const {
        area,
        level,
        notes,
        achievements,
        engagementLevel = '',
        engagementDescription,
        attendance = '',
        taskCompletionLevel = '',
        taskCompletionDescription,
        nextStepTips,
    } = req.body;
    if (!area || !level) {
        return res.status(400).json({ error: 'Area and level are required' });
    }
    // Analytics reads these as numbers / categories, so reject anything else.
    if (!LIKERT_VALUES.includes(String(engagementLevel)) || !LIKERT_VALUES.includes(String(taskCompletionLevel))) {
        return res.status(400).json({ error: 'Engagement and task completion must be 1-5' });
    }
    if (!ATTENDANCE_VALUES.includes(String(attendance))) {
        return res.status(400).json({ error: "Attendance must be 'present' or 'not present'" });
    }
    const progressData = {
        area,
        level,
        notes,
        achievements,
        engagementLevel: String(engagementLevel),
        engagementDescription,
        attendance: String(attendance),
        taskCompletionLevel: String(taskCompletionLevel),
        taskCompletionDescription,
        nextStepTips,
    };
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
    getAttentionList,
    supportPriority,
    getLearners,
    createLearner,
    bulkCreateLearners,
    getSensoryLogs,
    createSensoryLog,
    getProgress,
    createProgress,
};
