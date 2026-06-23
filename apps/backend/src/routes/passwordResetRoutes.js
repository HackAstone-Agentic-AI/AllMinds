const express = require('express');
const rateLimit = require('express-rate-limit');
const { forgotPassword, resetPassword } = require('../controllers/passwordResetController');

const router = express.Router();

// 5 req / hr — throttles email dispatch to prevent abuse
const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many password reset requests, please try again after an hour.' },
});

// 20 req / hr — one-time token is the real protection; limiter only stops brute-force token guessing
const resetPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many reset attempts, please try again after an hour.' },
});

router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password', resetPasswordLimiter, resetPassword);

module.exports = router;
