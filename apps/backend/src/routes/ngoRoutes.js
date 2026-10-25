const express = require('express');
const rateLimit = require('express-rate-limit');
const {
    getNGOs,
    getNGOById,
    submitReview,
    reportNgo,
    getTrainingResources,
} = require('../controllers/ngoController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Reviews and reports are user-generated content; keep volume reasonable.
const feedbackLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.user.id),
    message: { error: 'Too many submissions. Please try again later.' },
});

router.get('/', getNGOs);
router.get('/training', getTrainingResources);
router.get('/:id', getNGOById);
router.post('/:id/review', authenticateToken, feedbackLimiter, submitReview);
router.post('/:id/report', authenticateToken, feedbackLimiter, reportNgo);

module.exports = router;
