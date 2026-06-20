const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { proxyAgentChat } = require('../controllers/agentController');

const router = express.Router();

router.post('/chat', authenticateToken, proxyAgentChat);

module.exports = router;
