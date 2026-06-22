const https = require('https');
const { URL, URLSearchParams } = require('url');
const pool = require('../config/database');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';
const CALENDAR_SCOPES = [CALENDAR_SCOPE, 'https://www.googleapis.com/auth/userinfo.email'].join(' ');

// Allowlist of error codes Google may send to the callback — anything else is replaced
const ALLOWED_CALENDAR_ERRORS = new Set([
    'access_denied', 'invalid_scope', 'server_error',
    'temporarily_unavailable', 'interaction_required',
]);

function getCallbackUrl() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    return `${backendUrl}/api/calendar/callback`;
}

function buildState(userId) {
    const payload = `${userId}:${Date.now()}`;
    const hmac = crypto
        .createHmac('sha256', process.env.JWT_SECRET)
        .update(payload)
        .digest('hex');
    return Buffer.from(`${payload}:${hmac}`).toString('base64url');
}

function parseState(state) {
    try {
        const decoded = Buffer.from(state, 'base64url').toString('utf8');
        // Split at first and last ':' so userId can never be confused with timestamp/hmac
        const firstColon = decoded.indexOf(':');
        const lastColon = decoded.lastIndexOf(':');
        if (firstColon === -1 || firstColon === lastColon) return null;
        const userId = decoded.slice(0, firstColon);
        const timestamp = decoded.slice(firstColon + 1, lastColon);
        const hmac = decoded.slice(lastColon + 1);
        const payload = `${userId}:${timestamp}`;
        const expected = crypto
            .createHmac('sha256', process.env.JWT_SECRET)
            .update(payload)
            .digest('hex');
        const hmacBuf = Buffer.from(hmac);
        const expectedBuf = Buffer.from(expected);
        // Guard against length mismatch before timingSafeEqual (throws on unequal lengths)
        if (hmacBuf.length !== expectedBuf.length) return null;
        if (!crypto.timingSafeEqual(hmacBuf, expectedBuf)) return null;
        // Reject stale states older than 10 minutes
        if (Date.now() - parseInt(timestamp) > 10 * 60 * 1000) return null;
        return parseInt(userId, 10);
    } catch {
        return null;
    }
}

const HTTPS_TIMEOUT_MS = 10_000;

function httpsPost(url, body) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const postData = new URLSearchParams(body).toString();
        const options = {
            hostname: parsed.hostname,
            path: parsed.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
            },
            timeout: HTTPS_TIMEOUT_MS,
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch {
                    reject(new Error('Invalid JSON from Google'));
                }
            });
        });
        req.on('timeout', () => req.destroy(new Error('Google token exchange timed out')));
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

function httpsGet(url, accessToken, redirectsLeft = 3) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const options = {
            hostname: parsed.hostname,
            path: parsed.pathname + parsed.search,
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: HTTPS_TIMEOUT_MS,
        };
        const req = https.request(options, (res) => {
            const { statusCode, headers } = res;
            if ([301, 302, 307, 308].includes(statusCode) && headers.location && redirectsLeft > 0) {
                res.resume(); // discard redirect body
                httpsGet(headers.location, accessToken, redirectsLeft - 1).then(resolve, reject);
                return;
            }
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                try {
                    resolve({ statusCode, body: JSON.parse(data) });
                } catch {
                    reject(new Error('Invalid JSON from Google'));
                }
            });
        });
        req.on('timeout', () => req.destroy(new Error('Google userinfo request timed out')));
        req.on('error', reject);
        req.end();
    });
}

const initiateCalendarOAuth = (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID) {
        return res.status(503).json({ error: 'Google OAuth is not configured on this server.' });
    }

    const state = buildState(req.user.id);
    const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: getCallbackUrl(),
        response_type: 'code',
        scope: CALENDAR_SCOPES,
        access_type: 'offline',
        prompt: 'consent',
        state,
    });

    const authorizationUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    if (req.query.format === 'json') {
        return res.json({ url: authorizationUrl });
    }
    res.redirect(authorizationUrl);
};

const handleCalendarCallback = async (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const { code, state, error } = req.query;

    if (error) {
        // Only forward known error codes to the frontend — never reflect arbitrary input
        const safeError = ALLOWED_CALENDAR_ERRORS.has(error) ? error : 'unknown_error';
        return res.redirect(`${frontendUrl}/dashboard?settings=integrations&calendar_error=${safeError}`);
    }

    const userId = parseState(state);
    if (!userId) {
        return res.redirect(`${frontendUrl}/dashboard?settings=integrations&calendar_error=invalid_state`);
    }

    if (!code) {
        return res.redirect(`${frontendUrl}/dashboard?settings=integrations&calendar_error=missing_code`);
    }

    try {
        // Exchange authorization code for tokens
        const tokenResponse = await httpsPost('https://oauth2.googleapis.com/token', {
            code,
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: getCallbackUrl(),
            grant_type: 'authorization_code',
        });

        if (tokenResponse.error) {
            console.error('Google token exchange error:', tokenResponse);
            return res.redirect(`${frontendUrl}/dashboard?settings=integrations&calendar_error=token_exchange_failed`);
        }

        const { access_token, refresh_token, expires_in } = tokenResponse;

        // Fetch the Gmail address — treat any non-200 or error body as a failure
        const userInfoResult = await httpsGet(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            access_token
        );
        if (userInfoResult.statusCode !== 200 || userInfoResult.body.error) {
            console.error('Google userinfo error:', userInfoResult.body);
            return res.redirect(`${frontendUrl}/dashboard?settings=integrations&calendar_error=userinfo_failed`);
        }
        const gmailEmail = userInfoResult.body.email || null;

        const expiryAt = expires_in
            ? new Date(Date.now() + expires_in * 1000).toISOString()
            : null;

        // Upsert the token into the database
        await pool.query(
            `INSERT INTO google_calendar_tokens
                (user_id, gmail_email, access_token, refresh_token, token_uri, scopes, expiry, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
             ON CONFLICT (user_id) DO UPDATE SET
                gmail_email   = EXCLUDED.gmail_email,
                access_token  = EXCLUDED.access_token,
                refresh_token = COALESCE(EXCLUDED.refresh_token, google_calendar_tokens.refresh_token),
                token_uri     = EXCLUDED.token_uri,
                scopes        = EXCLUDED.scopes,
                expiry        = EXCLUDED.expiry,
                updated_at    = CURRENT_TIMESTAMP`,
            [
                userId,
                gmailEmail,
                access_token,
                refresh_token || null,
                'https://oauth2.googleapis.com/token',
                [CALENDAR_SCOPE],
                expiryAt,
            ]
        );

        res.redirect(
            `${frontendUrl}/dashboard?settings=integrations&calendar_connected=true&gmail=${encodeURIComponent(gmailEmail || '')}`
        );
    } catch (err) {
        console.error('Calendar OAuth callback error:', err);
        res.redirect(`${frontendUrl}/dashboard?settings=integrations&calendar_error=server_error`);
    }
};

const getCalendarStatus = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT gmail_email, updated_at
             FROM google_calendar_tokens
             WHERE user_id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.json({ connected: false, gmail_email: null });
        }

        const { gmail_email, updated_at } = result.rows[0];
        res.json({ connected: true, gmail_email, connected_at: updated_at });
    } catch (err) {
        console.error('Get calendar status error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const disconnectCalendar = async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM google_calendar_tokens WHERE user_id = $1',
            [req.user.id]
        );
        res.json({ message: 'Google Calendar disconnected successfully.' });
    } catch (err) {
        console.error('Disconnect calendar error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    initiateCalendarOAuth,
    handleCalendarCallback,
    getCalendarStatus,
    disconnectCalendar,
};
