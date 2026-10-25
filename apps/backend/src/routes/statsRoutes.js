const express = require('express');
const { getAdminStats, getTeacherStats, getImpactStats } = require('../controllers/statsController');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/admin', authenticateToken, authorizeAdmin, getAdminStats);
router.get('/impact', authenticateToken, getImpactStats);
router.get('/teacher', authenticateToken, getTeacherStats);

module.exports = router;