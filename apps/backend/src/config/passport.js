const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const OAuth2Strategy = require('passport-oauth2');
const pool = require('./database');
const jwt = require('jsonwebtoken');
const https = require('https');
const crypto = require('crypto');
const { isPlaceholder } = require('./env');

const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';

// ---------------------------------------------------------------------------
// Apple JWKS verification
// ---------------------------------------------------------------------------
let _appleKeysCache = null;
let _appleKeysCacheExpiry = 0;

function fetchApplePublicKeys() {
    if (_appleKeysCache && Date.now() < _appleKeysCacheExpiry) {
        return Promise.resolve(_appleKeysCache);
    }
    return new Promise((resolve, reject) => {
        https.get('https://appleid.apple.com/auth/keys', (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                try {
                    const { keys } = JSON.parse(data);
                    if (!Array.isArray(keys) || keys.length === 0) {
                        throw new Error('Apple JWKS response missing or empty keys array');
                    }
                    _appleKeysCache = keys;
                    _appleKeysCacheExpiry = Date.now() + 60 * 60 * 1000; // cache 1 hour
                    resolve(keys);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function verifyAppleIdToken(idToken) {
    const headerB64 = idToken.split('.')[0];
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
    const keys = await fetchApplePublicKeys();
    const jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) throw new Error(`Apple public key not found for kid: ${header.kid}`);
    // Node 16+ supports importing a JWK directly via createPublicKey
    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    return jwt.verify(
        idToken,
        publicKey.export({ type: 'spki', format: 'pem' }),
        {
            algorithms: ['RS256'],
            issuer: 'https://appleid.apple.com',
            audience: process.env.APPLE_CLIENT_ID,
        }
    );
}

const parseName = (fullName = '') => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    return {
        name: parts[0] || '',
        surname: parts.slice(1).join(' ') || '',
    };
};

const ensureTeacherProfile = async (userId, fullName) => {
    const { name, surname } = parseName(fullName);
    await pool.query(
        `INSERT INTO teacher_profiles (user_id, title, name, surname, theme_preference)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId, null, name || null, surname || null, 'light']
    );
};

const findOrCreateOAuthUser = async ({ email, fullName }) => {
    let userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    let user;

    if (userResult.rows.length === 0) {
        const insertResult = await pool.query(
            `INSERT INTO users (email, password_hash, full_name, role, is_active, email_verified)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, email, full_name, role, school_name, province`,
            [email, '', fullName, 'teacher', true, true]
        );
        user = insertResult.rows[0];
    } else {
        // Ensure existing OAuth users are also marked as verified
        if (!userResult.rows[0].email_verified) {
            await pool.query('UPDATE users SET email_verified = true WHERE id = $1', [userResult.rows[0].id]);
        }
        user = userResult.rows[0];
    }

    await ensureTeacherProfile(user.id, fullName);
    return user;
};

const buildAuthPayload = (user) => ({
    user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        school_name: user.school_name || '',
        province: user.province || '',
    },
});

if (!isPlaceholder(process.env.GOOGLE_CLIENT_ID) && !isPlaceholder(process.env.GOOGLE_CLIENT_SECRET)) {
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: `${backendUrl}/api/auth/google/callback`,
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    const email = profile.emails?.[0]?.value;
                    const fullName = profile.displayName || email;

                    if (!email) {
                        return done(new Error('Google account did not provide an email address'));
                    }

                    const user = await findOrCreateOAuthUser({ email, fullName });
                    return done(null, buildAuthPayload(user));
                } catch (err) {
                    return done(err, null);
                }
            }
        )
    );
}

if (!isPlaceholder(process.env.MICROSOFT_CLIENT_ID) && !isPlaceholder(process.env.MICROSOFT_CLIENT_SECRET)) {
    const microsoftStrategy = new OAuth2Strategy(
        {
            authorizationURL: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
            tokenURL: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
            clientID: process.env.MICROSOFT_CLIENT_ID,
            clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
            callbackURL: `${backendUrl}/api/auth/microsoft/callback`,
            state: false,
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value;
                const fullName = profile.displayName || email;

                if (!email) {
                    return done(new Error('Microsoft account did not provide an email address'));
                }

                const user = await findOrCreateOAuthUser({ email, fullName });
                return done(null, buildAuthPayload(user));
            } catch (err) {
                return done(err, null);
            }
        }
    );

    microsoftStrategy.userProfile = async (accessToken, done) => {
        try {
            const response = await fetch(
                'https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName',
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );
            const data = await response.json();

            done(null, {
                provider: 'microsoft',
                displayName: data.displayName,
                emails: [{ value: data.mail || data.userPrincipalName }],
            });
        } catch (error) {
            done(error);
        }
    };

    passport.use('microsoft', microsoftStrategy);
}

if (!isPlaceholder(process.env.APPLE_CLIENT_ID) && !isPlaceholder(process.env.APPLE_CLIENT_SECRET)) {
    const appleStrategy = new OAuth2Strategy(
        {
            authorizationURL: 'https://appleid.apple.com/auth/authorize',
            tokenURL: 'https://appleid.apple.com/auth/token',
            clientID: process.env.APPLE_CLIENT_ID,
            clientSecret: process.env.APPLE_CLIENT_SECRET,
            callbackURL: `${backendUrl}/api/auth/apple/callback`,
            state: false,
            passReqToCallback: true,
        },
        async (req, accessToken, refreshToken, params, profile, done) => {
            try {
                const idToken = params?.id_token;
                if (!idToken) {
                    return done(new Error('Apple did not return an id_token'));
                }
                // Verify signature, issuer, audience, and expiry against Apple's public keys
                const decoded = await verifyAppleIdToken(idToken);
                const appleUser =
                    typeof req.body?.user === 'string' ? JSON.parse(req.body.user) : req.body?.user;
                const email = decoded.email;
                const fullName = appleUser?.name
                    ? `${appleUser.name.firstName || ''} ${appleUser.name.lastName || ''}`.trim()
                    : decoded.email || 'Apple User';

                if (!email) {
                    return done(new Error('Apple account did not provide an email address'));
                }

                const user = await findOrCreateOAuthUser({ email, fullName });
                return done(null, buildAuthPayload(user));
            } catch (err) {
                return done(err, null);
            }
        }
    );

    appleStrategy.authorizationParams = () => ({
        response_mode: 'form_post',
    });

    appleStrategy.userProfile = (accessToken, done) => done(null, {});

    passport.use('apple', appleStrategy);
}

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

module.exports = passport;
