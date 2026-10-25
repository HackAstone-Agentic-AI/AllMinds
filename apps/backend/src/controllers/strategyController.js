const pool = require('../config/database');
const { findPii, piiMessage } = require('../utils/pii');

const CHALLENGE_TYPES = ['transitions', 'sensory', 'attention', 'communication', 'literacy', 'numeracy', 'behaviour', 'social', 'other'];

// Get all community strategies (with filtering)
const getStrategies = async (req, res) => {
    const { challenge_type, grade_level, sort } = req.query;
    
    let query = `
        SELECT cs.id, cs.title, cs.challenge_type, cs.description, 
               cs.grade_level, cs.materials_needed, cs.helpful_count,
               cs.created_at, cs.is_approved, COALESCE(u.full_name, 'AllMinds starter library') as author_name,
               (cs.user_id = $1) AS is_mine,
               CASE WHEN $1::int IS NOT NULL THEN 
                    EXISTS(SELECT 1 FROM strategy_votes sv WHERE sv.strategy_id = cs.id AND sv.user_id = $1)
               ELSE false END as user_voted
        FROM community_strategies cs
        LEFT JOIN users u ON cs.user_id = u.id
        WHERE (cs.is_approved = true OR cs.user_id = $1)
    `;
    const params = [req.user?.id || null];
    let paramIndex = 2;

    if (challenge_type && challenge_type !== 'all') {
        query += ` AND cs.challenge_type = $${paramIndex++}`;
        params.push(challenge_type);
    }

    if (grade_level && grade_level !== 'all') {
        query += ` AND cs.grade_level = $${paramIndex++}`;
        params.push(grade_level);
    }

    if (sort === 'popular') {
        query += ` ORDER BY cs.helpful_count DESC`;
    } else {
        query += ` ORDER BY cs.created_at DESC`;
    }

    query += ` LIMIT 50`;

    try {
        const result = await pool.query(query, params);
        res.json({ strategies: result.rows, count: result.rows.length });
    } catch (error) {
        console.error('Get strategies error:', error);
        res.status(500).json({ error: 'Failed to fetch strategies' });
    }
};

// Get single strategy by ID
const getStrategyById = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            `SELECT cs.*, COALESCE(u.full_name, 'AllMinds starter library') as author_name
             FROM community_strategies cs
             LEFT JOIN users u ON cs.user_id = u.id
             WHERE cs.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Strategy not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get strategy by ID error:', error);
        res.status(500).json({ error: 'Failed to fetch strategy' });
    }
};

// Create new strategy
const createStrategy = async (req, res) => {
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const challengeType = String(req.body.challenge_type || 'other').trim().toLowerCase();
    const gradeLevel = String(req.body.grade_level || '').trim();
    const materials = String(req.body.materials_needed || '').trim();
    const userId = req.user.id;

    if (!title || !description) {
        return res.status(400).json({ error: 'Title and description are required' });
    }
    if (title.length > 150 || description.length > 3000 || gradeLevel.length > 50 || materials.length > 500) {
        return res.status(400).json({ error: 'One of the fields is too long' });
    }
    if (!CHALLENGE_TYPES.includes(challengeType)) {
        return res.status(400).json({ error: `challenge_type must be one of: ${CHALLENGE_TYPES.join(', ')}` });
    }
    const pii = findPii(`${title}\n${description}\n${materials}`);
    if (pii.length) return res.status(400).json({ error: piiMessage(pii) });

    try {
        const result = await pool.query(
            `INSERT INTO community_strategies
             (user_id, title, challenge_type, description, grade_level, materials_needed, is_approved)
             VALUES ($1, $2, $3, $4, $5, $6, false)
             RETURNING id, title, challenge_type, created_at, is_approved`,
            [userId, title, challengeType, description, gradeLevel || null, materials || null]
        );
        res.status(201).json({
            message: 'Strategy submitted. It is visible to you now and to everyone once a moderator approves it.',
            strategy: result.rows[0]
        });
    } catch (error) {
        console.error('Create strategy error:', error);
        res.status(500).json({ error: 'Failed to create strategy' });
    }
};

// Moderator approval so teacher submissions become visible to everyone.
const approveStrategy = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid strategy id' });
    try {
        const result = await pool.query(
            'UPDATE community_strategies SET is_approved = true WHERE id = $1 RETURNING id',
            [id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Strategy not found' });
        res.json({ message: 'Strategy approved' });
    } catch (error) {
        console.error('Approve strategy error:', error);
        res.status(500).json({ error: 'Failed to approve strategy' });
    }
};

// Vote on strategy (helpful button)
const voteStrategy = async (req, res) => {
    const id = Number(req.params.id);
    const userId = req.user.id;
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid strategy id' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const insertResult = await client.query(
            'INSERT INTO strategy_votes (strategy_id, user_id) VALUES ($1, $2) ON CONFLICT ON CONSTRAINT strategy_votes_strategy_user_unique DO NOTHING',
            [id, userId]
        );

        if (insertResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'You have already voted for this strategy' });
        }

        const result = await client.query(
            `UPDATE community_strategies
             SET helpful_count = helpful_count + 1
             WHERE id = $1
             RETURNING helpful_count`,
            [id]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Strategy not found' });
        }

        await client.query('COMMIT');
        res.json({
            message: 'Voted successfully',
            helpful_count: result.rows[0].helpful_count,
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Vote strategy error:', error);
        res.status(500).json({ error: 'Failed to vote' });
    } finally {
        client.release();
    }
};

module.exports = { getStrategies, getStrategyById, createStrategy, voteStrategy, approveStrategy, CHALLENGE_TYPES };