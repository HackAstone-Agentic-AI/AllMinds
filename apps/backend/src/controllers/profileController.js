const pool = require('../config/database');

// Get teacher profile (merge users + teacher_profiles)
const getProfile = async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await pool.query(`
            SELECT u.id, u.email, u.full_name, u.school_name, u.province, u.city,
                   tp.title, tp.name, tp.surname, tp.theme_preference
            FROM users u
            LEFT JOIN teacher_profiles tp ON u.id = tp.user_id
            WHERE u.id = $1
        `, [userId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
};

// Update teacher profile
const updateProfile = async (req, res) => {
    const userId = req.user.id;
    const { title, name, surname, theme_preference } = req.body;
    try {
        // Upsert into teacher_profiles
        await pool.query(`
            INSERT INTO teacher_profiles (user_id, title, name, surname, theme_preference)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id) DO UPDATE SET
                title = EXCLUDED.title,
                name = EXCLUDED.name,
                surname = EXCLUDED.surname,
                theme_preference = EXCLUDED.theme_preference,
                updated_at = CURRENT_TIMESTAMP
        `, [userId, title, name, surname, theme_preference]);
        res.json({ message: 'Profile updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update profile' });
    }
};

module.exports = { getProfile, updateProfile };