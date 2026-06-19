const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
    createTask,
    getLessonPlans,
    getRecentActivities,
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

module.exports = router;
