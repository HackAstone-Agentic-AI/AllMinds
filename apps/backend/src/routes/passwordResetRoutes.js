const express = require('express');
const rateLimit = require('express-rate-limit');
const { forgotPassword, resetPassword } = require('../controllers/passwordResetController');

const router = express.Router();

// 5 req / hr on forgot-password only; reset-password is protected by the one-time token
const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many password reset requests, please try again after an hour.' },
});

router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
