const pool = require('../config/database');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { sendEmail } = require('../config/email');
const { isPlaceholder } = require('../config/env');

const RESET_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

const hashToken = (token) =>
    crypto.createHash('sha256').update(token).digest('hex');

// SMTP is considered usable only when host/user/pass are all real (not placeholders).
const isEmailConfigured = () =>
    !isPlaceholder(process.env.EMAIL_HOST) &&
    !isPlaceholder(process.env.EMAIL_USER) &&
    !isPlaceholder(process.env.EMAIL_PASS);

const buildPasswordResetEmail = (resetLink) => `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
      <h2 style="color:#0b4f5c">Reset your All Minds password</h2>
      <p>Use the button below to choose a new password. This link expires in 24 hours.</p>
      <p style="margin:24px 0">
        <a href="${resetLink}"
           style="background:#0b4f5c;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
          Reset password
        </a>
      </p>
      <p style="color:#666;font-size:13px">If you did not request this, you can ignore this email.</p>
    </div>
`;

// Request password reset
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!normalizedEmail) {
        return res.status(400).json({ error: 'Email is required' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({ error: 'Enter a valid email address' });
    }

    try {
        const userResult = await pool.query(
            'SELECT id, email FROM users WHERE LOWER(email) = $1',
            [normalizedEmail],
        );

        if (userResult.rows.length === 0) {
            return res.json({
                message: 'If that email is registered, you will receive a reset link.',
                reset_email_sent: true,
            });
        }

        const user = userResult.rows[0];
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(token);
        const expiresAt = new Date(Date.now() + RESET_EXPIRY_MS);

        await pool.query(
            'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [user.id, tokenHash, expiresAt],
        );

        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

        // Dev fallback: when SMTP isn't configured the email can never be delivered,
        // so rather than failing the flow we keep the token and return the reset link
        // directly. The link is only exposed outside production.
        if (!isEmailConfigured()) {
            console.warn('[password-reset] SMTP not configured — returning reset link in the response (dev mode).');
            await pool.query(
                'DELETE FROM password_reset_tokens WHERE user_id = $1 AND token <> $2',
                [user.id, tokenHash],
            );
            return res.json({
                message: 'Email delivery is not set up on this server. Use the reset link below to continue.',
                reset_email_sent: false,
                ...(process.env.NODE_ENV !== 'production' ? { reset_link: resetLink } : {}),
            });
        }

        const sent = await sendEmail(
            user.email,
            'Reset your All Minds password',
            buildPasswordResetEmail(resetLink),
        );

        if (!sent) {
            await pool.query('DELETE FROM password_reset_tokens WHERE token = $1', [tokenHash]);
            return res.status(503).json({
                error: 'Password reset email could not be sent. Please try again later.',
                reset_email_sent: false,
            });
        }

        await pool.query(
            'DELETE FROM password_reset_tokens WHERE user_id = $1 AND token <> $2',
            [user.id, tokenHash],
        );

        return res.json({
            message: 'If that email is registered, you will receive a reset link.',
            reset_email_sent: true,
        });
    } catch (err) {
        console.error('Forgot password error:', err);
        return res.status(500).json({ error: 'Failed to process request' });
    }
};

// Reset password using token
const resetPassword = async (req, res) => {
    const { token, new_password } = req.body;
    const normalizedToken = typeof token === 'string' ? token.trim() : '';

    if (!normalizedToken || !new_password) {
        return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (typeof new_password !== 'string') {
        return res.status(400).json({ error: 'New password must be text' });
    }

    if (new_password.length < 8 || new_password.length > 128) {
        return res.status(400).json({ error: 'Password must be between 8 and 128 characters' });
    }

    const tokenHash = hashToken(normalizedToken);
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const tokenResult = await client.query(
            'SELECT user_id, expires_at FROM password_reset_tokens WHERE token = $1',
            [tokenHash],
        );

        if (tokenResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Invalid or expired token' });
        }

        const { user_id, expires_at } = tokenResult.rows[0];
        if (new Date() > expires_at) {
            await client.query('DELETE FROM password_reset_tokens WHERE token = $1', [tokenHash]);
            await client.query('COMMIT');
            return res.status(400).json({ error: 'Token has expired' });
        }

        await client.query('DELETE FROM password_reset_tokens WHERE token = $1', [tokenHash]);

        const hashedPassword = await bcrypt.hash(
            new_password,
            parseInt(process.env.BCRYPT_ROUNDS, 10) || 10,
        );
        await client.query(
            'UPDATE users SET password_hash = $1, email_verified = true WHERE id = $2',
            [hashedPassword, user_id],
        );

        await client.query('COMMIT');
        return res.json({ message: 'Password reset successfully. You can now login.' });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => null);
        console.error('Reset password error:', err);
        return res.status(500).json({ error: 'Failed to reset password' });
    } finally {
        client.release();
    }
};

module.exports = { forgotPassword, resetPassword };
