const pool = require('../config/database');

// Get all community strategies (with filtering)
const getStrategies = async (req, res) => {
    const { challenge_type, grade_level, sort } = req.query;
    
    let query = `
        SELECT cs.id, cs.title, cs.challenge_type, cs.description, 
               cs.grade_level, cs.materials_needed, cs.helpful_count,
               cs.created_at, u.full_name as author_name,
               CASE WHEN $1::int IS NOT NULL THEN 
                    EXISTS(SELECT 1 FROM strategy_votes sv WHERE sv.strategy_id = cs.id AND sv.user_id = $1)
               ELSE false END as user_voted
        FROM community_strategies cs
        JOIN users u ON cs.user_id = u.id
        WHERE cs.is_approved = true
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
            `SELECT cs.*, u.full_name as author_name
             FROM community_strategies cs
             JOIN users u ON cs.user_id = u.id
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
    const { title, challenge_type, description, grade_level, materials_needed } = req.body;
    const userId = req.user.id;

    if (!title || !description) {
        return res.status(400).json({ error: 'Title and description are required' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO community_strategies 
             (user_id, title, challenge_type, description, grade_level, materials_needed, is_approved)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, title, challenge_type, created_at`,
            [userId, title, challenge_type, description, grade_level, materials_needed, false] // needs admin approval
        );

        res.status(201).json({
            message: 'Strategy submitted for approval',
            strategy: result.rows[0]
        });
    } catch (error) {
        console.error('Create strategy error:', error);
        res.status(500).json({ error: 'Failed to create strategy' });
    }
};

// Vote on strategy (helpful button)
const voteStrategy = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const insertResult = await client.query(
            'INSERT INTO strategy_votes (strategy_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
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

module.exports = { getStrategies, getStrategyById, createStrategy, voteStrategy };