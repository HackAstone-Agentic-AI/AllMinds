const pool = require('../config/database');

// Get dashboard statistics for admin
const getAdminStats = async (req, res) => {
    try {
        const schoolId = req.user.school_id || (await getSchoolIdByAdmin(req.user.id));
        if (!schoolId) {
            return res.status(404).json({ error: 'No school associated with this admin account' });
        }

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

// Minutes a teacher would typically spend producing each artefact by hand. Shown in the
// UI as stated assumptions, not measurements.
const MINUTES_SAVED = { lesson: 45, support: 30, parent: 20, visual: 20, multimodal: 15, rag: 10, ngo: 10 };
const DEFAULT_MINUTES = 5;

const getImpactStats = async (req, res) => {
    const teacherId = req.user.id;
    try {
        const [usage, languages, learners, records] = await Promise.all([
            pool.query(
                'SELECT tool, COUNT(*)::int AS n FROM ai_usage WHERE teacher_id = $1 GROUP BY tool',
                [teacherId]
            ),
            pool.query(
                'SELECT DISTINCT language_pref FROM ai_usage WHERE teacher_id = $1 ORDER BY language_pref',
                [teacherId]
            ),
            pool.query('SELECT COUNT(*)::int AS n FROM learner_profiles WHERE teacher_id = $1', [teacherId]),
            pool.query('SELECT COUNT(*)::int AS n FROM learner_progress WHERE teacher_id = $1', [teacherId]),
        ]);
        const byTool = Object.fromEntries(usage.rows.map((row) => [row.tool, row.n]));
        const minutes = usage.rows.reduce(
            (sum, row) => sum + row.n * (MINUTES_SAVED[row.tool] ?? DEFAULT_MINUTES), 0
        );
        res.json({
            learnersSupported: learners.rows[0].n,
            progressRecords: records.rows[0].n,
            lessonPlans: byTool.lesson || 0,
            supportPlans: byTool.support || 0,
            parentLetters: byTool.parent || 0,
            visualSupports: byTool.visual || 0,
            aiRequests: usage.rows.reduce((sum, row) => sum + row.n, 0),
            languagesUsed: languages.rows.map((row) => row.language_pref),
            hoursSaved: Math.round((minutes / 60) * 10) / 10,
            assumptions: MINUTES_SAVED,
        });
    } catch (error) {
        console.error('Get impact stats error:', error);
        res.status(500).json({ error: 'Failed to fetch impact stats' });
    }
};

module.exports = { getAdminStats, getTeacherStats, getImpactStats };