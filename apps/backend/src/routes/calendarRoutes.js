const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
    initiateCalendarOAuth,
    handleCalendarCallback,
    getCalendarStatus,
    disconnectCalendar,
    createCalendarEvent,
} = require('../controllers/calendarController');

const router = express.Router();

// GET /api/calendar/connect  — redirect user to Google OAuth for calendar access
router.get('/connect', authenticateToken, initiateCalendarOAuth);

// GET /api/calendar/callback — Google redirects here after the user grants access
router.get('/callback', handleCalendarCallback);

// GET /api/calendar/status  — check if the authenticated user has calendar connected
router.get('/status', authenticateToken, getCalendarStatus);

// POST /api/calendar/events — create an event on the authenticated user's calendar
router.post('/events', authenticateToken, createCalendarEvent);

// DELETE /api/calendar/disconnect — remove calendar tokens for the authenticated user
router.delete('/disconnect', authenticateToken, disconnectCalendar);

module.exports = router;
