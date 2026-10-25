const express = require('express');
const {
    getStrategies,
    getStrategyById,
    createStrategy,
    voteStrategy,
    approveStrategy,
} = require('../controllers/strategyController');
const { authenticateToken, authorizeAdmin, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', optionalAuth, getStrategies);
router.get('/:id', getStrategyById);
router.post('/', authenticateToken, createStrategy);
router.post('/:id/vote', authenticateToken, voteStrategy);
router.patch('/:id/approve', authenticateToken, authorizeAdmin, approveStrategy);

module.exports = router;
