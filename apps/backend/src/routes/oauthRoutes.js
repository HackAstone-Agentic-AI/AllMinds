const express = require('express');
const passport = require('../config/passport');
const rateLimit = require('express-rate-limit');

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

const handleSuccess = (req, res) => {
    const { user, token } = req.user;
    redirectToFrontend(res, {
        token,
        user: JSON.stringify(user),
    });
};

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
