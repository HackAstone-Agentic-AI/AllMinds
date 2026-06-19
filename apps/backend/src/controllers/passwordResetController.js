const pool = require('../config/database');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { sendEmail } = require('../config/email');

// Request password reset
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    try {
        // Find user
        const userResult = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            // For security, don't reveal that user doesn't exist
            return res.json({ message: 'If that email is registered, you will receive a reset link.' });
        }

        const user = userResult.rows[0];

        // Generate token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour

        // Store token
        await pool.query(
            'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [user.id, token, expiresAt]
        );

        // Send email
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

    try {
        // Find valid token
        const tokenResult = await pool.query(
            'SELECT user_id, expires_at FROM password_reset_tokens WHERE token = $1',
            [token]
        );
        if (tokenResult.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }

        const { user_id, expires_at } = tokenResult.rows[0];
        if (new Date() > expires_at) {
            return res.status(400).json({ error: 'Token has expired' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(new_password, 10);

        // Update user password
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, user_id]);

        // Delete used token
        await pool.query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);

        res.json({ message: 'Password reset successfully. You can now login.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to reset password' });
    }
};

module.exports = { forgotPassword, resetPassword };