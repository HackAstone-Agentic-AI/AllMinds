const express = require('express');
const passport = require('../config/passport');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const router = express.Router();

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

// 30 req / 15 min — applied per OAuth route, not at the /api/auth prefix
const oauthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts, please try again after 15 minutes.' },
});

const redirectToFrontend = (res, payload) => {
    const params = new URLSearchParams(payload);
    res.redirect(`${frontendUrl}/oauth-callback?${params.toString()}`);
};

const providerMissing = (provider) => (req, res) => {
    redirectToFrontend(res, { error: `${provider}_oauth_not_configured` });
};

const hashCode = (code) =>
    crypto.createHash('sha256').update(code).digest('hex');

const handleSuccess = async (req, res) => {
    try {
        const code = crypto.randomBytes(32).toString('base64url');
        await pool.query(
            'DELETE FROM oauth_login_codes WHERE expires_at <= CURRENT_TIMESTAMP'
        );
        await pool.query(
            `INSERT INTO oauth_login_codes (code_hash, user_id, expires_at)
             VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '5 minutes')`,
            [hashCode(code), req.user.user.id]
        );
        redirectToFrontend(res, { code });
    } catch (error) {
        console.error('OAuth login code creation failed:', error);
        redirectToFrontend(res, { error: 'oauth_failed' });
    }
};

router.post('/oauth/exchange', oauthLimiter, async (req, res) => {
    const code = typeof req.body.code === 'string' ? req.body.code.trim() : '';
    if (!code) {
        return res.status(400).json({ error: 'OAuth exchange code is required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const codeResult = await client.query(
            `DELETE FROM oauth_login_codes
             WHERE code_hash = $1 AND expires_at > CURRENT_TIMESTAMP
             RETURNING user_id`,
            [hashCode(code)]
        );

        if (codeResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'OAuth code is invalid or expired' });
        }

        const userResult = await client.query(
            `SELECT id, email, full_name, role, school_name, province, is_active
             FROM users WHERE id = $1`,
            [codeResult.rows[0].user_id]
        );
        const user = userResult.rows[0];
        if (!user || !user.is_active) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Account is unavailable' });
        }

        await client.query('COMMIT');
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        return res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                role: user.role,
                school_name: user.school_name || '',
                province: user.province || '',
            },
        });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => null);
        console.error('OAuth code exchange failed:', error);
        return res.status(500).json({ error: 'Could not complete OAuth sign-in' });
    } finally {
        client.release();
    }
});

if (passport._strategy('google')) {
    router.get('/google', oauthLimiter, passport.authenticate('google', { scope: ['profile', 'email'] }));
    router.get(
        '/google/callback',
        oauthLimiter,
        passport.authenticate('google', {
            session: false,
            failureRedirect: `${frontendUrl}/oauth-callback?error=google_oauth_failed`,
        }),
        handleSuccess
    );
} else {
    router.get('/google', oauthLimiter, providerMissing('google'));
    router.get('/google/callback', oauthLimiter, providerMissing('google'));
}

if (passport._strategy('microsoft')) {
    router.get(
        '/microsoft',
        oauthLimiter,
        passport.authenticate('microsoft', {
            scope: ['openid', 'profile', 'email', 'User.Read'],
        })
    );
    router.get(
        '/microsoft/callback',
        oauthLimiter,
        passport.authenticate('microsoft', {
            session: false,
            failureRedirect: `${frontendUrl}/oauth-callback?error=microsoft_oauth_failed`,
        }),
        handleSuccess
    );
} else {
    router.get('/microsoft', oauthLimiter, providerMissing('microsoft'));
    router.get('/microsoft/callback', oauthLimiter, providerMissing('microsoft'));
}

if (passport._strategy('apple')) {
    router.get(
        '/apple',
        oauthLimiter,
        passport.authenticate('apple', {
            scope: ['name', 'email'],
        })
    );
    router.all(
        '/apple/callback',
        oauthLimiter,
        passport.authenticate('apple', {
            session: false,
            failureRedirect: `${frontendUrl}/oauth-callback?error=apple_oauth_failed`,
        }),
        handleSuccess
    );
} else {
    router.get('/apple', oauthLimiter, providerMissing('apple'));
    router.all('/apple/callback', oauthLimiter, providerMissing('apple'));
}

module.exports = router;
