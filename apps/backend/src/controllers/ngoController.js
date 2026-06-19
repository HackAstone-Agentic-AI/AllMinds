const pool = require('../config/database');

// Get all NGOs with filters
const getNGOs = async (req, res) => {
    const { province, city, service, search } = req.query;
    
    let query = `
        SELECT id, name, province, city, services, contact_phone, contact_email, 
               website, rating, verified, latitude, longitude
        FROM ngos
        WHERE verified = true
    `;
    const params = [];
    let paramIndex = 1;

    if (province && province !== 'all') {
        query += ` AND province = $${paramIndex++}`;
        params.push(province);
    }

    if (city && city !== 'all') {
        query += ` AND city ILIKE $${paramIndex++}`;
        params.push(`%${city}%`);
    }

    if (service && service !== 'all') {
        query += ` AND $${paramIndex++} = ANY(services)`;
        params.push(service);
    }

    if (search) {
        query += ` AND (name ILIKE $${paramIndex++} OR address ILIKE $${paramIndex++})`;
        params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY rating DESC LIMIT 100`;

    try {
        const result = await pool.query(query, params);
        res.json({ ngos: result.rows, count: result.rows.length });
    } catch (error) {
        console.error('Get NGOs error:', error);
        res.status(500).json({ error: 'Failed to fetch NGOs' });
    }
};

// Get single NGO by ID
const getNGOById = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            `SELECT n.*, 
                    COALESCE(AVG(nr.rating), 0) as avg_rating,
                    COUNT(nr.id) as review_count
             FROM ngos n
             LEFT JOIN ngo_reviews nr ON n.id = nr.ngo_id
             WHERE n.id = $1
             GROUP BY n.id`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'NGO not found' });
        }

        // Get reviews for this NGO
        const reviewsResult = await pool.query(
            `SELECT nr.rating, nr.comment, nr.created_at, u.full_name
             FROM ngo_reviews nr
             JOIN users u ON nr.user_id = u.id
             WHERE nr.ngo_id = $1
             ORDER BY nr.created_at DESC
             LIMIT 20`,
            [id]
        );

        res.json({
            ...result.rows[0],
            reviews: reviewsResult.rows
        });
    } catch (error) {
        console.error('Get NGO by ID error:', error);
        res.status(500).json({ error: 'Failed to fetch NGO details' });
    }
};

// Submit review for NGO
const submitReview = async (req, res) => {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id;

    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    try {
        // Check if user already reviewed this NGO
        const existing = await pool.query(
            'SELECT id FROM ngo_reviews WHERE ngo_id = $1 AND user_id = $2',
            [id, userId]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'You have already reviewed this NGO' });
        }

        // Insert review
        await pool.query(
            'INSERT INTO ngo_reviews (ngo_id, user_id, rating, comment) VALUES ($1, $2, $3, $4)',
            [id, userId, rating, comment]
        );

        // Update NGO average rating
        await pool.query(
            `UPDATE ngos 
             SET rating = (SELECT COALESCE(AVG(rating), 0) FROM ngo_reviews WHERE ngo_id = $1)
             WHERE id = $1`,
            [id]
        );

        res.status(201).json({ message: 'Review submitted successfully' });
    } catch (error) {
        console.error('Submit review error:', error);
        res.status(500).json({ error: 'Failed to submit review' });
    }
};

module.exports = { getNGOs, getNGOById, submitReview };