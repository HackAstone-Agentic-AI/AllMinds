const express = require('express');
const { getNGOs, getNGOById, submitReview } = require('../controllers/ngoController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', getNGOs);
router.get('/:id', getNGOById);
router.post('/:id/review', authenticateToken, submitReview);

module.exports = router;