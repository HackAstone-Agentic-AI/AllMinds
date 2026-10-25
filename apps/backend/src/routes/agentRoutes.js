const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticateToken } = require('../middleware/auth');
const { proxyAgentChat, proxyAgentChatStream, proxyAgentMemory } = require('../controllers/agentController');

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
router.post('/chat/stream', authenticateToken, agentLimiter, proxyAgentChatStream);
router.get('/memory', authenticateToken, proxyAgentMemory);
router.delete('/memory', authenticateToken, proxyAgentMemory);

module.exports = router;
