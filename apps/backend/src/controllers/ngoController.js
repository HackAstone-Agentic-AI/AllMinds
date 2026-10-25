const pool = require('../config/database');
const { findPii, piiMessage } = require('../utils/pii');

// Get all NGOs with filters
const toRadians = (value) => (value * Math.PI) / 180;

// Great-circle distance in km between two points.
const haversineKm = (lat1, lon1, lat2, lon2) => {
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const STOP_WORDS = new Set(['a', 'an', 'and', 'for', 'in', 'my', 'of', 'the', 'to', 'with', 'needs', 'need', 'learner', 'child', 'support']);

const needTerms = (need) =>
    String(need || '')
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter((term) => term.length > 2 && !STOP_WORDS.has(term))
        // Crude stem so "diagnosis" matches "diagnostic" and "therapist" matches "therapy".
        .map((term) => (term.length > 6 ? term.slice(0, term.length - 3) : term));

// Share of the teacher's need terms found in the organisation's services, name or description.
const needMatch = (ngo, terms) => {
    if (terms.length === 0) return 0;
    const haystack = [ngo.name, ngo.description, ...(ngo.services || [])].join(' ').toLowerCase();
    const hits = terms.filter((term) => haystack.includes(term)).length;
    return hits / terms.length;
};

const MAX_DISTANCE_KM = 100;

// Explainable ranking: 0.5 distance + 0.3 need match + 0.2 rating (each scaled 0-1).
// Without a location, local organisations share a neutral distance score.
const rankNgo = (ngo, { lat, lng, terms }) => {
    const hasOrigin = Number.isFinite(lat) && Number.isFinite(lng);
    const hasCoords = ngo.latitude !== null && ngo.longitude !== null;
    const distanceKm = hasOrigin && hasCoords
        ? haversineKm(lat, lng, Number(ngo.latitude), Number(ngo.longitude))
        : null;
    // National services score just below a nearby local organisation.
    let distanceScore = 0.5;
    if (ngo.coverage === 'national') distanceScore = 0.45;
    else if (distanceKm !== null) distanceScore = Math.max(0, 1 - distanceKm / MAX_DISTANCE_KM);
    const match = needMatch(ngo, terms);
    const rating = Number(ngo.rating) || 0;
    const score = 0.5 * distanceScore + 0.3 * match + 0.2 * (rating / 5);

    const reasons = [];
    if (ngo.coverage === 'national') reasons.push('National service');
    else if (distanceKm !== null) reasons.push(`${distanceKm.toFixed(1)} km away`);
    const matched = (ngo.services || []).filter((service) =>
        terms.some((term) => service.toLowerCase().includes(term)));
    if (matched.length) reasons.push(matched.slice(0, 2).join(', '));
    if (Number(ngo.review_count) > 0) reasons.push(`${rating.toFixed(1)} stars (${ngo.review_count} reviews)`);

    return { ...ngo, distanceKm, needMatch: Number(match.toFixed(2)), score: Number(score.toFixed(3)), reasons };
};

const getNGOs = async (req, res) => {
    const { province, city, service, search, need } = req.query;
    const lat = req.query.lat !== undefined ? Number(req.query.lat) : NaN;
    const lng = req.query.lng !== undefined ? Number(req.query.lng) : NaN;

    let query = `
        SELECT n.id, n.name, n.province, n.city, n.address, n.services, n.contact_phone, n.contact_email,
               n.website, n.rating, n.verified, n.latitude, n.longitude, n.source_url, n.last_checked,
               n.coverage, n.location_precision, n.description,
               (SELECT COUNT(*)::int FROM ngo_reviews r WHERE r.ngo_id = n.id) AS review_count
        FROM ngos n
        WHERE n.verified = true
    `;
    const params = [];
    let paramIndex = 1;

    if (province && province !== 'all') {
        // National services stay visible when filtering by province.
        query += ` AND (n.province = $${paramIndex++} OR n.coverage = 'national')`;
        params.push(province);
    }

    if (city && city !== 'all') {
        query += ` AND (n.city ILIKE $${paramIndex++} OR n.coverage = 'national')`;
        params.push(`%${city}%`);
    }

    if (service && service !== 'all') {
        query += ` AND EXISTS (SELECT 1 FROM unnest(n.services) s WHERE s ILIKE $${paramIndex++})`;
        params.push(`%${service}%`);
    }

    if (search) {
        query += ` AND (n.name ILIKE $${paramIndex} OR n.address ILIKE $${paramIndex} OR n.description ILIKE $${paramIndex}
                   OR EXISTS (SELECT 1 FROM unnest(n.services) s WHERE s ILIKE $${paramIndex}))`;
        paramIndex += 1;
        params.push(`%${search}%`);
    }

    query += ' LIMIT 200';

    try {
        const result = await pool.query(query, params);
        const terms = needTerms(need || search || service);
        const ranked = result.rows
            .map((ngo) => rankNgo(ngo, { lat, lng, terms }))
            .sort((a, b) => b.score - a.score);
        res.json({ ngos: ranked, count: ranked.length });
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

    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
        return res.status(400).json({ error: 'Rating must be a whole number between 1 and 5' });
    }
    if (comment && String(comment).length > 1000) {
        return res.status(400).json({ error: 'Comment must be 1000 characters or fewer' });
    }
    const pii = findPii(comment);
    if (pii.length) return res.status(400).json({ error: piiMessage(pii) });

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
            [id, userId, numericRating, comment || null]
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

// Teacher flags outdated or wrong directory information.
const reportNgo = async (req, res) => {
    const ngoId = Number(req.params.id);
    const issue = String(req.body.issue || '').trim();
    if (!Number.isInteger(ngoId) || ngoId <= 0) return res.status(400).json({ error: 'Invalid organisation' });
    if (issue.length < 3 || issue.length > 1000) {
        return res.status(400).json({ error: 'Describe the problem in 3 to 1000 characters' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO ngo_reports (ngo_id, user_id, issue)
             SELECT id, $2, $3 FROM ngos WHERE id = $1 RETURNING id`,
            [ngoId, req.user.id, issue]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Organisation not found' });
        res.status(201).json({ message: 'Thanks - the directory team will check this listing.' });
    } catch (error) {
        console.error('Report NGO error:', error);
        res.status(500).json({ error: 'Failed to submit report' });
    }
};

const getTrainingResources = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, title, provider, topic, duration, cost, url, description, last_checked
             FROM training_resources WHERE is_active = true ORDER BY topic, title`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get training resources error:', error);
        res.status(500).json({ error: 'Failed to fetch training resources' });
    }
};

module.exports = { getNGOs, getNGOById, submitReview, reportNgo, getTrainingResources, rankNgo, haversineKm };