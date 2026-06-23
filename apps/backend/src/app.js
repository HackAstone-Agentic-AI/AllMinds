const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { validateEnv } = require('./config/env');

const envStatus = validateEnv();
const passport = require('./config/passport');

// 20 req / 15 min — login and register only
// OAuth and password-reset routes carry their own limiters in their route files
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP, please try again after 15 minutes.' },
});

const authRoutes = require('./routes/authRoutes');
const ngoRoutes = require('./routes/ngoRoutes');
const strategyRoutes = require('./routes/strategyRoutes');
const schoolRoutes = require('./routes/schoolRoutes');
const statsRoutes = require('./routes/statsRoutes');
const agentRoutes = require('./routes/agentRoutes');
const calendarRoutes = require('./routes/calendarRoutes');

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
}));
app.use(compression());

// Middleware
const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(
    cors({
        origin(origin, callback) {
            if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
                callback(null, true);
                return;
            }
            callback(new Error('Not allowed by CORS'));
        },
        credentials: true,
    })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
// oauthLimiter is applied per-route inside oauthRoutes.js
app.use('/api/auth', require('./routes/oauthRoutes'));
// forgotPasswordLimiter is applied per-route inside passwordResetRoutes.js
app.use('/api/auth', require('./routes/passwordResetRoutes'));
app.use('/api/parent-communications', require('./routes/parentCommRoutes'));
app.use('/api/profile', require('./routes/profileRoutes'));
app.use('/api/learners', require('./routes/learnerRoutes'));
app.use('/api/forum', require('./routes/forumRoutes'));
app.use('/api/activities', require('./routes/activityRoutes'));
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/ngos', ngoRoutes);
app.use('/api/strategies', strategyRoutes);
app.use('/api/school', schoolRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/calendar', calendarRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        oauthProviders: envStatus.configuredProviders,
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        ...(isDev && { stack: err.stack }),
    });
});

module.exports = app;
