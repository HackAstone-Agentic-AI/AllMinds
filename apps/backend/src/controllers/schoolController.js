const pool = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = './uploads/curriculum';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.pdf', '.docx', '.txt'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF, DOCX, and TXT files are allowed'));
        }
    }
});

// ============ CLASS MANAGEMENT ============

// Get all classes for a school
const getClasses = async (req, res) => {
    const schoolId = req.user.school_id || (await getSchoolIdByAdmin(req.user.id));

    try {
        const result = await pool.query(
            `SELECT c.*, 
                    COUNT(DISTINCT tc.teacher_id) as teacher_count,
                    COUNT(DISTINCT l.id) as learner_count
             FROM classes c
             LEFT JOIN teacher_classes tc ON c.id = tc.class_id
             LEFT JOIN learners l ON c.id = l.class_id
             WHERE c.school_id = $1 AND c.is_active = true
             GROUP BY c.id
             ORDER BY c.grade_level, c.class_name`,
            [schoolId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get classes error:', error);
        res.status(500).json({ error: 'Failed to fetch classes' });
    }
};

// Create new class
const createClass = async (req, res) => {
    const { class_name, grade_level, academic_year } = req.body;
    const schoolId = req.user.school_id || (await getSchoolIdByAdmin(req.user.id));

    if (!class_name) {
        return res.status(400).json({ error: 'Class name is required' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO classes (school_id, class_name, grade_level, academic_year)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [schoolId, class_name, grade_level, academic_year || new Date().getFullYear()]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create class error:', error);
        res.status(500).json({ error: 'Failed to create class' });
    }
};

// ============ TEACHER ASSIGNMENT ============

// Get all teachers in school
const getTeachers = async (req, res) => {
    const schoolId = req.user.school_id || (await getSchoolIdByAdmin(req.user.id));

    try {
        const result = await pool.query(
            `SELECT u.id, u.email, u.full_name, u.phone, u.created_at,
                    array_agg(DISTINCT c.class_name) as assigned_classes
             FROM users u
             LEFT JOIN teacher_classes tc ON u.id = tc.teacher_id
             LEFT JOIN classes c ON tc.class_id = c.id
             WHERE u.role = 'teacher' AND u.school_name = (SELECT name FROM schools WHERE id = $1)
             GROUP BY u.id`,
            [schoolId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get teachers error:', error);
        res.status(500).json({ error: 'Failed to fetch teachers' });
    }
};

// Assign teacher to class
const assignTeacherToClass = async (req, res) => {
    const { teacher_id, class_id } = req.body;

    try {
        await pool.query(
            'INSERT INTO teacher_classes (teacher_id, class_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [teacher_id, class_id]
        );

        res.json({ message: 'Teacher assigned successfully' });
    } catch (error) {
        console.error('Assign teacher error:', error);
        res.status(500).json({ error: 'Failed to assign teacher' });
    }
};

// ============ LEARNER MANAGEMENT ============

// Get learners in a class
const getLearners = async (req, res) => {
    const { class_id } = req.params;

    try {
        const result = await pool.query(
            `SELECT id, pseudonym, age_years, support_needs, successful_strategies, created_at
             FROM learners
             WHERE class_id = $1
             ORDER BY created_at DESC`,
            [class_id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get learners error:', error);
        res.status(500).json({ error: 'Failed to fetch learners' });
    }
};

// Create learner (anonymous)
const createLearner = async (req, res) => {
    const { class_id, pseudonym, age_years, support_needs, successful_strategies } = req.body;

    if (!class_id || !pseudonym) {
        return res.status(400).json({ error: 'Class ID and pseudonym are required' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO learners (class_id, pseudonym, age_years, support_needs, successful_strategies)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [class_id, pseudonym, age_years, support_needs, successful_strategies]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create learner error:', error);
        res.status(500).json({ error: 'Failed to create learner' });
    }
};

// ============ DOCUMENT UPLOAD ============

// Upload curriculum document
const uploadDocument = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const { title, document_type, grade_level, subject } = req.body;
    const schoolId = req.user.school_id || (await getSchoolIdByAdmin(req.user.id));
    const userId = req.user.id;

    try {
        const result = await pool.query(
            `INSERT INTO curriculum_documents 
             (school_id, uploaded_by, title, document_type, grade_level, subject, file_path, file_size)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id, title, document_type, file_path`,
            [schoolId, userId, title || req.file.originalname, document_type, grade_level, subject, req.file.path, req.file.size]
        );

        res.status(201).json({
            message: 'Document uploaded successfully',
            document: result.rows[0]
        });
    } catch (error) {
        console.error('Upload document error:', error);
        res.status(500).json({ error: 'Failed to save document metadata' });
    }
};

// Get all documents
const getDocuments = async (req, res) => {
    const schoolId = req.user.school_id || (await getSchoolIdByAdmin(req.user.id));

    try {
        const result = await pool.query(
            `SELECT cd.*, u.full_name as uploaded_by_name
             FROM curriculum_documents cd
             JOIN users u ON cd.uploaded_by = u.id
             WHERE cd.school_id = $1
             ORDER BY cd.uploaded_at DESC`,
            [schoolId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get documents error:', error);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
};

// Helper function
async function getSchoolIdByAdmin(adminId) {
    const result = await pool.query(
        'SELECT id FROM schools WHERE id = (SELECT school_id FROM users WHERE id = $1)',
        [adminId]
    );
    return result.rows[0]?.id;
}

module.exports = {
    upload,
    getClasses,
    createClass,
    getTeachers,
    assignTeacherToClass,
    getLearners,
    createLearner,
    uploadDocument,
    getDocuments
};