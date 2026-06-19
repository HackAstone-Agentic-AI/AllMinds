const nodemailer = require('nodemailer');

// Configure using environment variables (add to .env)
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendEmail = async (to, subject, html) => {
    try {
        await transporter.sendMail({
            from: `"AllMinds Support" <${process.env.EMAIL_FROM}>`,
            to,
            subject,
            html,
        });
        return true;
    } catch (err) {
        console.error('Email send error:', err);
        return false;
    }
};

module.exports = { sendEmail };