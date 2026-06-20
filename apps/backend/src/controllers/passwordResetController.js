const pool = require('../config/database');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { sendEmail } = require('../config/email');

const hashToken = (token) =>
    crypto.createHash('sha256').update(token).digest('hex');

// Request password reset
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    try {
        const userResult = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.json({ message: 'If that email is registered, you will receive a reset link.' });
        }

        const user = userResult.rows[0];

        // Invalidate any existing tokens for this user before issuing a new one
        await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);

        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(token);
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour

        await pool.query(
            'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [user.id, tokenHash, expiresAt]
        );

        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
        const html = `
            <h2>Reset Your AllMinds Password</h2>
            <p>Click the link below to reset your password. This link expires in 1 hour.</p>
            <a href="${resetLink}">${resetLink}</a>
            <p>If you did not request this, please ignore this email.</p>
        `;
        await sendEmail(email, 'AllMinds Password Reset', html);

        res.json({ message: 'If that email is registered, you will receive a reset link.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to process request' });
    }
};

// Reset password using token
const resetPassword = async (req, res) => {
    const { token, new_password } = req.body;
    if (!token || !new_password) {
        return res.status(400).json({ error: 'Token and new password are required' });
    }
    if (new_password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const tokenHash = hashToken(token);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const tokenResult = await client.query(
            'SELECT user_id, expires_at FROM password_reset_tokens WHERE token = $1',
            [tokenHash]
        );
        if (tokenResult.rows.length === 0) {
            try { await client.query('ROLLBACK'); } catch (_) {}
            return res.status(400).json({ error: 'Invalid or expired token' });
        }

        const { user_id, expires_at } = tokenResult.rows[0];
        if (new Date() > expires_at) {
            try { await client.query('ROLLBACK'); } catch (_) {}
            return res.status(400).json({ error: 'Token has expired' });
        }

        // Delete the token first — prevents reuse even if password update fails
        await client.query('DELETE FROM password_reset_tokens WHERE token = $1', [tokenHash]);

        const hashedPassword = await bcrypt.hash(new_password, 10);
        await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, user_id]);

        await client.query('COMMIT');
        res.json({ message: 'Password reset successfully. You can now login.' });
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        console.error(err);
        res.status(500).json({ error: 'Failed to reset password' });
    } finally {
        client.release();
    }
};

module.exports = { forgotPassword, resetPassword };
