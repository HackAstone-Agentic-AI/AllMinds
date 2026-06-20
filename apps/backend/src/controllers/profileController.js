const pool = require('../config/database');

// Get teacher profile (merge users + teacher_profiles)
const getProfile = async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await pool.query(`
            SELECT u.id, u.email, u.full_name, u.school_name, u.province, u.city,
                   u.language_pref,
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
    const { title, name, surname, theme_preference, language_pref } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query(`
            INSERT INTO teacher_profiles (user_id, title, name, surname, theme_preference)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id) DO UPDATE SET
                title = EXCLUDED.title,
                name = EXCLUDED.name,
                surname = EXCLUDED.surname,
                theme_preference = EXCLUDED.theme_preference,
                updated_at = CURRENT_TIMESTAMP
        `, [userId, title, name, surname, theme_preference]);

        if (language_pref !== undefined) {
            await client.query(
                'UPDATE users SET language_pref = $1 WHERE id = $2',
                [language_pref, userId]
            );
        }

        await client.query('COMMIT');
        res.json({ message: 'Profile updated successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Failed to update profile' });
    } finally {
        client.release();
    }
};

module.exports = { getProfile, updateProfile };