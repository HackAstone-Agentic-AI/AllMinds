const express = require('express');
const { getStrategies, getStrategyById, createStrategy, voteStrategy } = require('../controllers/strategyController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', getStrategies);
router.get('/:id', getStrategyById);
router.post('/', authenticateToken, createStrategy);
router.post('/:id/vote', authenticateToken, voteStrategy);

module.exports = router;