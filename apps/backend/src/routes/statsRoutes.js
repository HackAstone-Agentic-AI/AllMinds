const express = require('express');
const { getAdminStats, getTeacherStats } = require('../controllers/statsController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/admin', authenticateToken, getAdminStats);
router.get('/teacher', authenticateToken, getTeacherStats);

module.exports = router;