const express = require('express');
const { proxyAgentChat } = require('../controllers/agentController');

const router = express.Router();

router.post('/chat', proxyAgentChat);

module.exports = router;
