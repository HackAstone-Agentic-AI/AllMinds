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
    const clean = (value, maxLength) =>
        typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
    const normalizedTheme = ['light', 'dark', 'auto'].includes(theme_preference)
        ? theme_preference
        : 'light';
    const normalizedLanguage =
        typeof language_pref === 'string' && /^[a-z]{2,3}(-[A-Z]{2})?$/.test(language_pref)
            ? language_pref
            : null;
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
        `, [
            userId,
            clean(title, 30) || null,
            clean(name, 100) || null,
            clean(surname, 100) || null,
            normalizedTheme,
        ]);

        if (normalizedLanguage) {
            await client.query(
                'UPDATE users SET language_pref = $1 WHERE id = $2',
                [normalizedLanguage, userId]
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
