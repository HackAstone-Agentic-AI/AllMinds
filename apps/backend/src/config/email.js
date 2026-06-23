const nodemailer = require('nodemailer');

const getEmailConfig = () => {
    const host = String(process.env.EMAIL_HOST || '').trim();
    const from = String(process.env.EMAIL_FROM || '').trim();
    const user = String(process.env.EMAIL_USER || '').trim();
    const pass = String(process.env.EMAIL_PASS || '').trim();
    const port = Number(process.env.EMAIL_PORT || 587);

    if (!host || !from || !Number.isInteger(port)) {
        throw new Error('Email delivery is not configured. Set EMAIL_HOST, EMAIL_PORT, and EMAIL_FROM.');
    }
    if ((user && !pass) || (!user && pass)) {
        throw new Error('Email authentication is incomplete. Set both EMAIL_USER and EMAIL_PASS.');
    }

    return {
        host,
        port,
        secure: process.env.EMAIL_SECURE === 'true',
        ...(user && pass ? { auth: { user, pass } } : {}),
    };
};

const sendEmail = async (to, subject, html) => {
    try {
        const transporter = nodemailer.createTransport(getEmailConfig());
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

module.exports = { sendEmail, getEmailConfig };
