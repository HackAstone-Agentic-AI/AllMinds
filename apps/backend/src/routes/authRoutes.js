const express = require('express');
const { register, login, getProfile } = require('../controllers/authController');
const { verifyEmail, resendVerification } = require('../controllers/emailVerificationController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/profile', authenticateToken, getProfile);
router.get('/verify-email', verifyEmail);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);

module.exports = router;