-- =====================================================
-- ALLMINDS DEMO SEED (development only)
-- Loaded by `npm run db:seed-demo` when ALLOW_DEMO_SEED=true and NODE_ENV is not
-- production. Never part of the baseline schema, so production databases do not
-- get a shared demo account with a known password.
-- =====================================================
-- -----------------------------------------------------
-- Sample data
-- -----------------------------------------------------

INSERT INTO schools (name, province, city, address, contact_email, contact_phone, subscription_status)
VALUES
('Sunrise Academy', 'Gauteng', 'Johannesburg', '24 Learning Way, Johannesburg', 'info@sunrise.org', '011-111-2222', 'trial');

INSERT INTO users (
    email,
    password_hash,
    full_name,
    role,
    school_name,
    province,
    city,
    phone,
    language_pref
)
VALUES (
    'teacher.demo@allminds.org',
    '$2b$10$LHi5vQ5cXLpp/svbbQMMg.PP508ipn2VwgQFg2WskGgT8vNRHJwci',
    'Ms Demo Teacher',
    'teacher',
    'Sunrise Academy',
    'Gauteng',
    'Johannesburg',
    '011-111-3333',
    'English'
);

INSERT INTO teacher_profiles (user_id, title, name, surname, theme_preference)
VALUES (
    (SELECT id FROM users WHERE email = 'teacher.demo@allminds.org'),
    'Ms',
    'Demo',
    'Teacher',
    'light'
);

INSERT INTO classes (school_id, class_name, grade_level, academic_year)
VALUES (
    (SELECT id FROM schools WHERE name = 'Sunrise Academy'),
    'Foundation Skills A',
    'Grade R',
    2026
);

INSERT INTO teacher_classes (teacher_id, class_id)
VALUES (
    (SELECT id FROM users WHERE email = 'teacher.demo@allminds.org'),
    (SELECT id FROM classes WHERE class_name = 'Foundation Skills A')
);

INSERT INTO learners (class_id, pseudonym, age_years, support_needs, successful_strategies)
VALUES
(
    (SELECT id FROM classes WHERE class_name = 'Foundation Skills A'),
    'Learner A',
    6,
    'Transition support, sensory regulation',
    'Visual countdowns, movement breaks'
),
(
    (SELECT id FROM classes WHERE class_name = 'Foundation Skills A'),
    'Learner B',
    7,
    'Communication scaffolds, predictable routines',
    'Choice boards, first-then language'
);

INSERT INTO learner_profiles (teacher_id, anonymous_id, profile_data)
VALUES
(
    (SELECT id FROM users WHERE email = 'teacher.demo@allminds.org'),
    'ALM-001',
    '{"age": 6, "support_need": "Sensory regulation", "notes": "Responds well to visual schedules"}'::jsonb
),
(
    (SELECT id FROM users WHERE email = 'teacher.demo@allminds.org'),
    'ALM-002',
    '{"age": 7, "support_need": "Communication support", "notes": "Benefits from short written instructions"}'::jsonb
);

INSERT INTO community_strategies (user_id, title, challenge_type, description, grade_level, materials_needed, helpful_count, is_approved)
VALUES
(
    (SELECT id FROM users WHERE email = 'teacher.demo@allminds.org'),
    'Visual Timer for Transitions',
    'transitions',
    'Use a sand timer with a countdown song. Reduced meltdowns by 70% in my class.',
    'Grade R',
    'Sand timer, transition song chart',
    24,
    true
),
(
    (SELECT id FROM users WHERE email = 'teacher.demo@allminds.org'),
    'Sensory Break Cards',
    'sensory',
    'Laminate cards with sensory activities. Child chooses one when overwhelmed.',
    'Grade R',
    'Laminated break cards',
    18,
    true
);

INSERT INTO strategy_votes (strategy_id, user_id)
VALUES
(
    (SELECT id FROM community_strategies WHERE title = 'Visual Timer for Transitions'),
    (SELECT id FROM users WHERE email = 'teacher.demo@allminds.org')
);

INSERT INTO lesson_history (user_id, topic, grade_level, adaptation_needs, generated_lesson, rating)
VALUES
(
    (SELECT id FROM users WHERE email = 'teacher.demo@allminds.org'),
    'Counting with Movement',
    'Grade R',
    'Short steps, movement breaks, visual aids',
    'Warm-up movement song, counting mats, partner turn-taking, visual exit card.',
    5
);

INSERT INTO lesson_plans (teacher_id, title, content)
VALUES
(
    (SELECT id FROM users WHERE email = 'teacher.demo@allminds.org'),
    'Morning Routine Visual Schedule',
    'Structured greeting, visual timetable review, sensory warm-up, and calm transition into circle time.'
),
(
    (SELECT id FROM users WHERE email = 'teacher.demo@allminds.org'),
    'Inclusive Counting Lesson',
    'Hands-on counting activity with visual prompts, movement options, and peer support.'
);

INSERT INTO activities (teacher_id, activity_type, description)
VALUES
(
    (SELECT id FROM users WHERE email = 'teacher.demo@allminds.org'),
    'parent_communication',
    'Created progress letter for learner ALM-001'
),
(
    (SELECT id FROM users WHERE email = 'teacher.demo@allminds.org'),
    'progress_update',
    'Updated progress for learner ALM-002'
),
(
    (SELECT id FROM users WHERE email = 'teacher.demo@allminds.org'),
    'task_created',
    'Created task "Prepare visual supports for Friday"'
);

INSERT INTO teacher_tasks (teacher_id, title, description, status, priority, due_date)
VALUES
(
    (SELECT id FROM users WHERE email = 'teacher.demo@allminds.org'),
    'Prepare visual supports for Friday',
    'Print the first-then boards and routine cards before the class observation.',
    'pending',
    'high',
    CURRENT_TIMESTAMP + INTERVAL '2 days'
),
(
    (SELECT id FROM users WHERE email = 'teacher.demo@allminds.org'),
    'Follow up with caregiver for ALM-001',
    'Send home the progress summary and request feedback on after-school routine changes.',
    'in_progress',
    'medium',
    CURRENT_TIMESTAMP + INTERVAL '1 day'
),
(
    (SELECT id FROM users WHERE email = 'teacher.demo@allminds.org'),
    'Review sensory toolkit logs',
    'Look for repeated trigger patterns before next support planning meeting.',
    'completed',
    'low',
    CURRENT_TIMESTAMP - INTERVAL '1 day'
);

INSERT INTO forum_posts (teacher_id, title, content)
VALUES
(
    (SELECT id FROM users WHERE email = 'teacher.demo@allminds.org'),
    'What transition supports work best in the first 10 minutes?',
    'I have seen progress with visual countdowns, but I would love other ideas for supporting anxious arrivals.'
);

INSERT INTO parent_communications (teacher_id, learner_id, type, content)
VALUES
(
    (SELECT id FROM users WHERE email = 'teacher.demo@allminds.org'),
    (SELECT id FROM learner_profiles WHERE anonymous_id = 'ALM-001'),
    'progress',
    'Learner ALM-001 responded well to the new visual routine this week and completed transitions with less prompting.'
),
(
    (SELECT id FROM users WHERE email = 'teacher.demo@allminds.org'),
    (SELECT id FROM learner_profiles WHERE anonymous_id = 'ALM-002'),
    'concern',
    'Learner ALM-002 showed signs of overload during independent work. We would like to align on calming strategies between school and home.'
);

INSERT INTO sensory_toolkit_logs (learner_id, teacher_id, log_data)
VALUES
(
    (SELECT id FROM learner_profiles WHERE anonymous_id = 'ALM-001'),
    (SELECT id FROM users WHERE email = 'teacher.demo@allminds.org'),
    '{"behavior":"Covering ears","trigger":"Noise during transition","response":"Moved to calm corner","notes":"Settled within 4 minutes"}'::jsonb
);

INSERT INTO learner_progress (learner_id, teacher_id, progress_data)
VALUES
(
    (SELECT id FROM learner_profiles WHERE anonymous_id = 'ALM-002'),
    (SELECT id FROM users WHERE email = 'teacher.demo@allminds.org'),
    '{
      "area":"Communication",
      "level":"Emerging",
      "achievements":"Used choice board independently twice this week",
      "notes":"Still needs support when group volume increases",
      "engagementLevel":"Moderate",
      "engagementDescription":"Stayed engaged during paired activities",
      "attendance":"Present 5/5 days",
      "taskCompletionLevel":"Moderate",
      "taskCompletionDescription":"Completes structured tasks with verbal prompting",
      "aiSuggestions":"Increase visual prompts and reduce background noise during writing blocks"
    }'::jsonb
);

