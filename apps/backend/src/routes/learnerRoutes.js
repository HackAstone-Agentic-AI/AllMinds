const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
    getLearners,
    createLearner,
    bulkCreateLearners,
    getSensoryLogs,
    createSensoryLog,
    getProgress,
    createProgress,
    getAttentionList,
} = require('../controllers/learnerController');

const router = express.Router();

// All learner routes require authentication
router.use(authenticateToken);

// Learner CRUD
router.get('/', getLearners);
router.get('/attention', getAttentionList);
router.post('/', createLearner);
router.post('/bulk', bulkCreateLearners);

// Sensory logs
router.get('/:learnerId/sensory-logs', getSensoryLogs);
router.post('/:learnerId/sensory-logs', createSensoryLog);

// Progress records
router.get('/:learnerId/progress', getProgress);
router.post('/:learnerId/progress', createProgress);

module.exports = router;