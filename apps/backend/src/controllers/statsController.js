const pool = require('../config/database');

// Get dashboard statistics for admin
const getAdminStats = async (req, res) => {
    const schoolId = req.user.school_id || (await getSchoolIdByAdmin(req.user.id));

    try {
        // Get counts
        const teacherCount = await pool.query(
            'SELECT COUNT(*) FROM users WHERE role = $1 AND school_name = (SELECT name FROM schools WHERE id = $2)',
            ['teacher', schoolId]
        );

        const classCount = await pool.query(
            'SELECT COUNT(*) FROM classes WHERE school_id = $1',
            [schoolId]
        );

        const learnerCount = await pool.query(
            `SELECT COUNT(l.id) 
             FROM learners l
             JOIN classes c ON l.class_id = c.id
             WHERE c.school_id = $1`,
            [schoolId]
        );

        const documentCount = await pool.query(
            'SELECT COUNT(*) FROM curriculum_documents WHERE school_id = $1',
            [schoolId]
        );

        const lessonCount = await pool.query(
            `SELECT COUNT(lh.id) 
             FROM lesson_history lh
             JOIN users u ON lh.user_id = u.id
             WHERE u.school_name = (SELECT name FROM schools WHERE id = $1)`,
            [schoolId]
        );

        // Get recent activities
        const recentLessons = await pool.query(
            `SELECT lh.topic, lh.created_at, u.full_name as teacher_name
             FROM lesson_history lh
             JOIN users u ON lh.user_id = u.id
             WHERE u.school_name = (SELECT name FROM schools WHERE id = $1)
             ORDER BY lh.created_at DESC
             LIMIT 10`,
            [schoolId]
        );

        res.json({
            stats: {
                teachers: parseInt(teacherCount.rows[0].count),
                classes: parseInt(classCount.rows[0].count),
                learners: parseInt(learnerCount.rows[0].count),
                documents: parseInt(documentCount.rows[0].count),
                lessons_generated: parseInt(lessonCount.rows[0].count)
            },
            recent_lessons: recentLessons.rows
        });
    } catch (error) {
        console.error('Get admin stats error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
};

// Get teacher's personal stats
const getTeacherStats = async (req, res) => {
    const userId = req.user.id;

    try {
        const lessonCount = await pool.query(
            'SELECT COUNT(*) FROM lesson_history WHERE user_id = $1',
            [userId]
        );

        const strategyCount = await pool.query(
            'SELECT COUNT(*) FROM community_strategies WHERE user_id = $1',
            [userId]
        );

        const reviewCount = await pool.query(
            'SELECT COUNT(*) FROM ngo_reviews WHERE user_id = $1',
            [userId]
        );

        const recentLessons = await pool.query(
            `SELECT topic, grade_level, created_at, rating
             FROM lesson_history
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 5`,
            [userId]
        );

        res.json({
            stats: {
                lessons_adapted: parseInt(lessonCount.rows[0].count),
                strategies_shared: parseInt(strategyCount.rows[0].count),
                ngo_reviews: parseInt(reviewCount.rows[0].count)
            },
            recent_lessons: recentLessons.rows
        });
    } catch (error) {
        console.error('Get teacher stats error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
};

async function getSchoolIdByAdmin(adminId) {
    const result = await pool.query(
        'SELECT id FROM schools WHERE id = (SELECT school_id FROM users WHERE id = $1)',
        [adminId]
    );
    return result.rows[0]?.id;
}

module.exports = { getAdminStats, getTeacherStats };