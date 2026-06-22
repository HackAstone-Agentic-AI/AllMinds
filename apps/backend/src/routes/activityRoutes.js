const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
    createScheduleItem,
    createTask,
    deleteScheduleItem,
    getLessonPlans,
    getRecentActivities,
    getScheduleItems,
    getTasks,
    updateTask,
} = require('../controllers/activityController');

const router = express.Router();

router.use(authenticateToken);

router.get('/activities', getRecentActivities);
router.get('/lesson-plans', getLessonPlans);
router.get('/tasks', getTasks);
router.post('/tasks', createTask);
router.patch('/tasks/:taskId', updateTask);
router.get('/schedule-items', getScheduleItems);
router.post('/schedule-items', createScheduleItem);
router.delete('/schedule-items/:scheduleItemId', deleteScheduleItem);

module.exports = router;
