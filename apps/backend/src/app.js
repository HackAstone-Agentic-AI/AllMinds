const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { validateEnv } = require('./config/env');

const envStatus = validateEnv();
const passport = require('./config/passport');

const authRoutes = require('./routes/authRoutes');
const ngoRoutes = require('./routes/ngoRoutes');
const strategyRoutes = require('./routes/strategyRoutes');
const schoolRoutes = require('./routes/schoolRoutes');
const statsRoutes = require('./routes/statsRoutes');
const agentRoutes = require('./routes/agentRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', require('./routes/oauthRoutes'));
app.use('/api/auth', require('./routes/passwordResetRoutes'));
app.use('/api/parent-communications', require('./routes/parentCommRoutes'));
app.use('/api/profile', require('./routes/profileRoutes'));
app.use('/api/learners', require('./routes/learnerRoutes'));
app.use('/api/forum', require('./routes/forumRoutes'));
app.use('/api/activities', require('./routes/activityRoutes'));
app.use('/api/auth', authRoutes);
app.use('/api/ngos', ngoRoutes);
app.use('/api/strategies', strategyRoutes);
app.use('/api/school', schoolRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/agent', agentRoutes);

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
