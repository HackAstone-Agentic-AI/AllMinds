// src/routes/profileRoutes.js
const express = require('express');
const { getProfile, updateProfile } = require('../controllers/profileController');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();
router.get('/', authenticateToken, getProfile);
router.put('/', authenticateToken, updateProfile);
module.exports = router;