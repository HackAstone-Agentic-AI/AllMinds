const express = require('express');
const passport = require('../config/passport');

const router = express.Router();

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

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
    router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
    router.get(
        '/google/callback',
        passport.authenticate('google', {
            session: false,
            failureRedirect: `${frontendUrl}/oauth-callback?error=google_oauth_failed`,
        }),
        handleSuccess
    );
} else {
    router.get('/google', providerMissing('google'));
    router.get('/google/callback', providerMissing('google'));
}

if (passport._strategy('microsoft')) {
    router.get(
        '/microsoft',
        passport.authenticate('microsoft', {
            scope: ['openid', 'profile', 'email', 'User.Read'],
        })
    );
    router.get(
        '/microsoft/callback',
        passport.authenticate('microsoft', {
            session: false,
            failureRedirect: `${frontendUrl}/oauth-callback?error=microsoft_oauth_failed`,
        }),
        handleSuccess
    );
} else {
    router.get('/microsoft', providerMissing('microsoft'));
    router.get('/microsoft/callback', providerMissing('microsoft'));
}

if (passport._strategy('apple')) {
    router.get(
        '/apple',
        passport.authenticate('apple', {
            scope: ['name', 'email'],
        })
    );
    router.all(
        '/apple/callback',
        passport.authenticate('apple', {
            session: false,
            failureRedirect: `${frontendUrl}/oauth-callback?error=apple_oauth_failed`,
        }),
        handleSuccess
    );
} else {
    router.get('/apple', providerMissing('apple'));
    router.all('/apple/callback', providerMissing('apple'));
}

module.exports = router;
