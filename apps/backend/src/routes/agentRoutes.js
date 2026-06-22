const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticateToken } = require('../middleware/auth');
const { proxyAgentChat } = require('../controllers/agentController');

const router = express.Router();

const agentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.user.id),
    message: { error: 'AI request limit reached. Please try again in a few minutes.' },
});

router.post('/chat', authenticateToken, agentLimiter, proxyAgentChat);

module.exports = router;
