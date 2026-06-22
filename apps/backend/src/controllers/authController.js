const pool = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// User Registration
const register = async (req, res) => {
    const {
        email,
        password,
        full_name,
        title,
        name,
        surname,
        school_name,
        province,
        city,
        phone,
        language_pref
    } = req.body;

    // Validation
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedFullName = typeof full_name === 'string' ? full_name.trim() : '';

    if (!normalizedEmail || !password || !normalizedFullName) {
        return res.status(400).json({ error: 'Email, password, and full name are required' });
    }
    if (password.length < 8 || password.length > 128) {
        return res.status(400).json({ error: 'Password must be between 8 and 128 characters' });
    }

    let client;

    try {
        // Check if user already exists
        const existingUser = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'User with this email already exists' });
        }

        // Hash password
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(
            `INSERT INTO users (email, password_hash, full_name, role, school_name, province, city, phone, language_pref)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, email, full_name, role, school_name, province`,
            [normalizedEmail, password_hash, normalizedFullName, 'teacher', school_name, province, city, phone, language_pref || 'en']
        );

        const user = result.rows[0];

        await client.query(
            `INSERT INTO teacher_profiles (user_id, title, name, surname, theme_preference)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id) DO UPDATE SET
                title = EXCLUDED.title,
                name = EXCLUDED.name,
                surname = EXCLUDED.surname,
                theme_preference = EXCLUDED.theme_preference,
                updated_at = CURRENT_TIMESTAMP`,
            [user.id, title || null, name || null, surname || null, 'light']
        );

        await client.query('COMMIT');

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                role: user.role,
                school_name: user.school_name,
                province: user.province
            }
        });
    } catch (error) {
        if (client) {
            await client.query('ROLLBACK').catch(() => null);
        }
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client?.release();
    }
};

// User Login
const login = async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!normalizedEmail || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        // Find user
        const result = await pool.query(
            'SELECT id, email, password_hash, full_name, role, school_name, province, is_active FROM users WHERE email = $1',
            [normalizedEmail]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = result.rows[0];

        // Check if account is active
        if (!user.is_active) {
            return res.status(401).json({ error: 'Account is deactivated. Contact admin.' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                role: user.role,
                school_name: user.school_name,
                province: user.province
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get current user profile
const getProfile = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, email, full_name, role, school_name, province, city, phone, language_pref, created_at FROM users WHERE id = $1',
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { register, login, getProfile };
