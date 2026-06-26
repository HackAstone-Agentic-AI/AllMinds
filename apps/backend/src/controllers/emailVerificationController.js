const pool = require('../config/database');
const crypto = require('crypto');
const { sendEmail } = require('../config/email');

const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESEND_COOLDOWN_MS = 60 * 1000;   // 1 minute between resend requests

const hashToken = (token) =>
    crypto.createHash('sha256').update(token).digest('hex');

const buildVerificationEmail = (verifyLink) => `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
      <h2 style="color:#0b4f5c">Welcome to All Minds</h2>
      <p>Please verify your email address to activate your account.</p>
      <p style="margin:24px 0">
        <a href="${verifyLink}"
           style="background:#0b4f5c;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
          Verify my email
        </a>
      </p>
      <p style="color:#666;font-size:13px">This link expires in 24 hours.</p>
      <p style="color:#666;font-size:13px">
        If you did not create an All Minds account, you can ignore this email.
      </p>
    </div>
`;

// Called after registration — generates and sends the verification email
const sendVerificationEmail = async (userId, email) => {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + EXPIRY_MS);

    await pool.query(
        'INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [userId, tokenHash, expiresAt],
    );

    const verifyLink = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
    const sent = await sendEmail(
        email,
        'Verify your All Minds account',
        buildVerificationEmail(verifyLink),
    );
    if (!sent) {
        await pool.query('DELETE FROM email_verification_tokens WHERE token = $1', [tokenHash]);
        throw new Error('Verification email delivery failed');
    }

    await pool.query(
        'DELETE FROM email_verification_tokens WHERE user_id = $1 AND token <> $2',
        [userId, tokenHash],
    );

    return true;
};

// GET /auth/verify-email?token=...  or  POST /auth/verify-email { token }
const verifyEmail = async (req, res) => {
    const token = req.query.token || req.body?.token;
    if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Verification token is required.' });
    }

    const tokenHash = hashToken(token);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const result = await client.query(
            'SELECT user_id, expires_at FROM email_verification_tokens WHERE token = $1',
            [tokenHash],
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'invalid_token', message: 'This verification link is invalid or has already been used.' });
        }

        const { user_id, expires_at } = result.rows[0];
        if (new Date() > expires_at) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'expired_token', message: 'This verification link has expired. Please request a new one.' });
        }

        await client.query('DELETE FROM email_verification_tokens WHERE token = $1', [tokenHash]);
        await client.query('UPDATE users SET email_verified = true WHERE id = $1', [user_id]);
        await client.query('COMMIT');

        return res.json({ message: 'Email verified successfully. You can now log in.' });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => null);
        console.error('Email verification error:', err);
        return res.status(500).json({ error: 'Verification failed. Please try again.' });
    } finally {
        client.release();
    }
};

// POST /auth/resend-verification { email }
const resendVerification = async (req, res) => {
    const { email } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!normalizedEmail) {
        return res.status(400).json({ error: 'Email is required.' });
    }

    try {
        const userResult = await pool.query(
            'SELECT id, email, email_verified FROM users WHERE LOWER(email) = $1',
            [normalizedEmail],
        );

        // Always return the same message to avoid email enumeration
        if (userResult.rows.length === 0) {
            return res.json({ message: 'If that email is registered and unverified, a new link has been sent.' });
        }

        const user = userResult.rows[0];

        if (user.email_verified) {
            return res.json({ message: 'This email is already verified. You can log in.' });
        }

        // Enforce cooldown — check most recent token creation time
        const cooldownResult = await pool.query(
            'SELECT created_at FROM email_verification_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
            [user.id],
        );
        if (cooldownResult.rows.length > 0) {
            const lastSent = new Date(cooldownResult.rows[0].created_at).getTime();
            if (Date.now() - lastSent < RESEND_COOLDOWN_MS) {
                return res.status(429).json({ error: 'Please wait a moment before requesting another verification email.' });
            }
        }

        await sendVerificationEmail(user.id, user.email);

        return res.json({ message: 'If that email is registered and unverified, a new link has been sent.' });
    } catch (err) {
        console.error('Resend verification error:', err);
        return res.status(500).json({ error: 'Could not send verification email. Please try again.' });
    }
};

module.exports = { verifyEmail, resendVerification, sendVerificationEmail };
