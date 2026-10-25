const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { loadDemoClassroom, removeDemoClassroom } = require('../controllers/demoController');

const router = express.Router();

router.post('/classroom', authenticateToken, loadDemoClassroom);
router.delete('/classroom', authenticateToken, removeDemoClassroom);

module.exports = router;
