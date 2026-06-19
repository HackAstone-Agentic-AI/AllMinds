const pool = require('../config/database');

// Get all parent communications for the logged-in teacher
// Optional query param: learnerId to filter by specific learner
const getCommunications = async (req, res) => {
    const teacherId = req.user.id;
    const { learnerId } = req.query;

    let query = `
        SELECT pc.*, lp.anonymous_id as learner_anonymous_id
        FROM parent_communications pc
        JOIN learner_profiles lp ON pc.learner_id = lp.id
        WHERE pc.teacher_id = $1
    `;
    const params = [teacherId];
    let paramIndex = 2;

    if (learnerId) {
        query += ` AND pc.learner_id = $${paramIndex++}`;
        params.push(learnerId);
    }

    query += ` ORDER BY pc.created_at DESC`;

    try {
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch parent communications' });
    }
};

// Create a new parent communication letter
const createCommunication = async (req, res) => {
    const teacherId = req.user.id;
    const { learner_id, type, content } = req.body;

    if (!learner_id || !type || !content) {
        return res.status(400).json({ error: 'learner_id, type, and content are required' });
    }
    if (!['progress', 'concern'].includes(type)) {
        return res.status(400).json({ error: 'type must be "progress" or "concern"' });
    }

    try {
        // Verify learner belongs to this teacher
        const learnerCheck = await pool.query(
            'SELECT id FROM learner_profiles WHERE id = $1 AND teacher_id = $2',
            [learner_id, teacherId]
        );
        if (learnerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Learner not found or not owned by you' });
        }

        const result = await pool.query(`
            INSERT INTO parent_communications (teacher_id, learner_id, type, content)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [teacherId, learner_id, type, content]);

        // Log activity
        await pool.query(`
            INSERT INTO activities (teacher_id, activity_type, description)
            VALUES ($1, $2, $3)
        `, [teacherId, 'parent_communication', `Created ${type} letter for learner ${learner_id}`]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create parent communication' });
    }
};

module.exports = { getCommunications, createCommunication };