const express = require('express');
const {
    getClasses,
    createClass,
    getTeachers,
    assignTeacherToClass,
    getLearners,
    createLearner,
    upload,
    uploadDocument,
    getDocuments
} = require('../controllers/schoolController');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

const router = express.Router();

// All school routes require authentication and admin role
router.use(authenticateToken, authorizeAdmin);

// Class management
router.get('/classes', getClasses);
router.post('/classes', createClass);

// Teacher management
router.get('/teachers', getTeachers);
router.post('/assign-teacher', assignTeacherToClass);

// Learner management
router.get('/classes/:class_id/learners', getLearners);
router.post('/learners', createLearner);

// Document management
router.post('/documents/upload', upload.single('document'), uploadDocument);
router.get('/documents', getDocuments);

module.exports = router;