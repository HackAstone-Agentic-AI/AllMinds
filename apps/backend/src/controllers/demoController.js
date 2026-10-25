const pool = require('../config/database');

// Synthetic demo classroom. Every learner is clearly labelled as demo data and uses a
// DEMO- anonymous id, so it can be removed again without touching real records.
const DEMO_PREFIX = 'DEMO-';

const LEARNERS = [
    { pseudonym: 'Amahle (demo)', grade: 'Grade 2', tags: ['ADHD'], needs: ['Movement breaks', 'Chunked instructions'], strengths: ['Creative storytelling', 'Helps peers'], trend: 'improving' },
    { pseudonym: 'Lethabo (demo)', grade: 'Grade 3', tags: ['Autism spectrum'], needs: ['Predictable routines', 'Visual schedule'], strengths: ['Pattern recognition', 'Strong memory'], trend: 'stable' },
    { pseudonym: 'Sipho (demo)', grade: 'Grade 3', tags: ['Dyslexia'], needs: ['Reading scaffolds', 'Audio support'], strengths: ['Verbal reasoning', 'Problem solving'], trend: 'declining' },
    { pseudonym: 'Naledi (demo)', grade: 'Grade 1', tags: ['Sensory processing differences'], needs: ['Quiet corner', 'Noise-reducing headphones'], strengths: ['Fine motor skills', 'Art'], trend: 'improving' },
    { pseudonym: 'Thabo (demo)', grade: 'Grade 4', tags: ['Dyscalculia'], needs: ['Concrete manipulatives', 'Extra time'], strengths: ['Reading', 'Kindness'], trend: 'declining' },
    { pseudonym: 'Zanele (demo)', grade: 'Grade 2', tags: ['Twice-exceptional'], needs: ['Enrichment tasks', 'Emotional coaching'], strengths: ['Advanced vocabulary', 'Curiosity'], trend: 'stable' },
    { pseudonym: 'Kagiso (demo)', grade: 'Grade R', tags: ['Autism spectrum', 'Speech delay'], needs: ['Choice boards', 'First-then language'], strengths: ['Puzzles', 'Music'], trend: 'improving' },
    { pseudonym: 'Lerato (demo)', grade: 'Grade 4', tags: ['ADHD', 'Dyslexia'], needs: ['Seating near teacher', 'Spelling supports'], strengths: ['Sport', 'Leadership'], trend: 'declining' },
    { pseudonym: 'Bongani (demo)', grade: 'Grade 1', tags: ['PDA profile'], needs: ['Low-demand phrasing', 'Choices'], strengths: ['Building', 'Humour'], trend: 'stable' },
    { pseudonym: 'Palesa (demo)', grade: 'Grade 3', tags: ['Anxiety', 'Autism spectrum'], needs: ['Transition warnings', 'Calm-down plan'], strengths: ['Drawing', 'Attention to detail'], trend: 'improving' },
];

const AREAS = ['Reading', 'Mathematics', 'Communication', 'Social Skills', 'Writing', 'Behavior'];
const WEEKS = 8;

// Deterministic pseudo-random numbers so the demo looks the same every time.
const rand = (seed) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
};

const clampLikert = (v) => Math.max(1, Math.min(5, Math.round(v)));

const buildWeek = (learner, learnerIndex, week) => {
    const base = learner.trend === 'declining' ? 4 : learner.trend === 'improving' ? 2 : 3;
    const slope = learner.trend === 'declining' ? -0.3 : learner.trend === 'improving' ? 0.3 : 0;
    const noise = (rand(learnerIndex * 31 + week * 7) - 0.5) * 1.2;
    const engagement = clampLikert(base + slope * week + noise);
    const completion = clampLikert(base + slope * week - noise / 2);
    const absent = rand(learnerIndex * 13 + week * 3) < (learner.trend === 'declining' ? 0.3 : 0.1);
    const level = engagement >= 5 ? 'Excellent' : engagement >= 4 ? 'Good' : engagement >= 3 ? 'Moderate' : 'Needs Support';
    return {
        area: AREAS[(learnerIndex + week) % AREAS.length],
        level,
        achievements: engagement >= 4 ? 'Completed the task independently' : 'Completed part of the task with support',
        notes: 'Synthetic demo record',
        engagementLevel: String(engagement),
        taskCompletionLevel: String(completion),
        attendance: absent ? 'not present' : 'present',
        demo: true,
    };
};

const loadDemoClassroom = async (req, res) => {
    const teacherId = req.user.id;
    const client = await pool.connect();
    try {
        const existing = await client.query(
            'SELECT COUNT(*)::int AS n FROM learner_profiles WHERE teacher_id = $1 AND anonymous_id LIKE $2',
            [teacherId, `${DEMO_PREFIX}%`]
        );
        if (existing.rows[0].n > 0) {
            return res.status(409).json({ error: 'The demo classroom is already loaded.' });
        }

        await client.query('BEGIN');
        const learnerIds = [];
        for (const [i, learner] of LEARNERS.entries()) {
            const anonymousId = `${DEMO_PREFIX}${String(i + 1).padStart(3, '0')}`;
            const inserted = await client.query(
                `INSERT INTO learner_profiles (teacher_id, anonymous_id, profile_data)
                 VALUES ($1, $2, $3) RETURNING id`,
                [teacherId, anonymousId, {
                    pseudonym: learner.pseudonym,
                    grade: learner.grade,
                    neurotypeTags: learner.tags,
                    supportNeeds: learner.needs,
                    strengths: learner.strengths,
                    recentNotes: 'Synthetic demo learner',
                    demo: true,
                }]
            );
            const learnerId = inserted.rows[0].id;
            learnerIds.push(learnerId);

            for (let week = 0; week < WEEKS; week += 1) {
                await client.query(
                    `INSERT INTO learner_progress (learner_id, teacher_id, progress_data, recorded_at)
                     VALUES ($1, $2, $3, CURRENT_TIMESTAMP - make_interval(weeks => $4))`,
                    [learnerId, teacherId, buildWeek(learner, i, week), WEEKS - 1 - week]
                );
            }

            await client.query(
                `INSERT INTO sensory_toolkit_logs (learner_id, teacher_id, log_data, logged_at)
                 VALUES ($1, $2, $3, CURRENT_TIMESTAMP - INTERVAL '2 days')`,
                [learnerId, teacherId, {
                    behavior: i % 2 ? 'Covered ears during group work' : 'Left seat repeatedly before lunch',
                    trigger: i % 2 ? 'Classroom noise' : 'Long seated task',
                    response: i % 2 ? 'Offered headphones and quiet corner' : 'Gave a movement break card',
                    notes: 'Synthetic demo log',
                    demo: true,
                }]
            );
        }

        const schedule = [
            ['07:45', 'Arrival and calm greeting'], ['08:00', 'Morning circle with visual timetable'],
            ['08:30', 'Reading with audio support'], ['09:30', 'Movement break'],
            ['10:00', 'Mathematics with manipulatives'], ['11:00', 'Lunch and quiet time'],
        ];
        for (const [time, title] of schedule) {
            await client.query(
                `INSERT INTO learner_schedule_items (teacher_id, learner_id, title, start_time, notes)
                 VALUES ($1, $2, $3, $4::time, $5)`,
                [teacherId, learnerIds[1], title, time, 'Demo schedule']
            );
        }

        await client.query(
            `INSERT INTO lesson_plans (teacher_id, title, content) VALUES ($1, $2, $3)`,
            [teacherId, 'Demo: Grade 3 fractions with manipulatives',
                'Objective: recognise halves and quarters.\n1. Warm-up with paper folding.\n2. Fraction strips in pairs.\n3. Exit card with pictures.\nAccommodations: visual steps, movement break, extra time.']
        );
        await client.query(
            `INSERT INTO parent_communications (teacher_id, learner_id, type, content) VALUES ($1, $2, 'progress', $3)`,
            [teacherId, learnerIds[0],
                '[Date]\n\nDear Parent/Carer,\n\nAmahle has shown lovely growth in staying focused during reading this term. Short movement breaks are helping her return to tasks with energy.\n\nAt home, you might try a two-minute stretch before homework.\n\nKind regards,\n[Your name]']
        );
        const tasks = [
            ['Print now/next boards for Lethabo', 'high', 1], ['Review Sipho reading supports', 'medium', 3],
            ['Send progress letter to Amahle\'s family', 'low', 5],
        ];
        for (const [title, priority, days] of tasks) {
            await client.query(
                `INSERT INTO teacher_tasks (teacher_id, title, description, priority, due_date)
                 VALUES ($1, $2, 'Demo task', $3, CURRENT_TIMESTAMP + make_interval(days => $4))`,
                [teacherId, title, priority, days]
            );
        }
        await client.query(
            `INSERT INTO activities (teacher_id, activity_type, description) VALUES ($1, 'demo_loaded', $2)`,
            [teacherId, `Loaded demo classroom with ${LEARNERS.length} synthetic learners`]
        );
        await client.query('COMMIT');
        res.status(201).json({ message: 'Demo classroom loaded.', learners: learnerIds.length, weeks: WEEKS });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => null);
        console.error('Demo classroom load failed:', err);
        res.status(500).json({ error: 'Could not load the demo classroom.' });
    } finally {
        client.release();
    }
};

const removeDemoClassroom = async (req, res) => {
    const teacherId = req.user.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Learner children (progress, logs, schedules, letters) cascade on delete.
        const removed = await client.query(
            'DELETE FROM learner_profiles WHERE teacher_id = $1 AND anonymous_id LIKE $2',
            [teacherId, `${DEMO_PREFIX}%`]
        );
        await client.query("DELETE FROM lesson_plans WHERE teacher_id = $1 AND title LIKE 'Demo:%'", [teacherId]);
        await client.query("DELETE FROM teacher_tasks WHERE teacher_id = $1 AND description = 'Demo task'", [teacherId]);
        await client.query("DELETE FROM activities WHERE teacher_id = $1 AND activity_type = 'demo_loaded'", [teacherId]);
        await client.query('COMMIT');
        res.json({ message: 'Demo classroom removed.', learners: removed.rowCount });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => null);
        console.error('Demo classroom removal failed:', err);
        res.status(500).json({ error: 'Could not remove the demo classroom.' });
    } finally {
        client.release();
    }
};

module.exports = { loadDemoClassroom, removeDemoClassroom };
