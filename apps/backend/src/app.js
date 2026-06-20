const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { validateEnv } = require('./config/env');

const envStatus = validateEnv();
const passport = require('./config/passport');

// 20 req / 15 min — login, register, profile
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP, please try again after 15 minutes.' },
});

// 5 req / hr — forgot-password only
const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many password reset requests, please try again after an hour.' },
});

// 30 req / 15 min — OAuth initiation and callbacks (separate budget from login)
const oauthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts, please try again after 15 minutes.' },
});

const authRoutes = require('./routes/authRoutes');
const ngoRoutes = require('./routes/ngoRoutes');
const strategyRoutes = require('./routes/strategyRoutes');
const schoolRoutes = require('./routes/schoolRoutes');
const statsRoutes = require('./routes/statsRoutes');
const agentRoutes = require('./routes/agentRoutes');
const calendarRoutes = require('./routes/calendarRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
// OAuth routes get their own limiter — separate budget from login/register
app.use('/api/auth', oauthLimiter, require('./routes/oauthRoutes'));
// forgot-password: tight per-hour limiter only (no authLimiter — avoids shared budget)
app.use('/api/auth/forgot-password', forgotPasswordLimiter);
// reset-password: no rate limiter — the one-time token is the protection
app.use('/api/auth', require('./routes/passwordResetRoutes'));
app.use('/api/parent-communications', require('./routes/parentCommRoutes'));
app.use('/api/profile', require('./routes/profileRoutes'));
app.use('/api/learners', require('./routes/learnerRoutes'));
app.use('/api/forum', require('./routes/forumRoutes'));
app.use('/api/activities', require('./routes/activityRoutes'));
// login, register, profile — single authLimiter, not double
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

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
