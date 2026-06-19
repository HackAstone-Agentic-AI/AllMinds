-- =====================================================
-- ALLMINDS COMPLETE DATABASE SCHEMA
-- PostgreSQL
-- Updated: 2026-04-23
-- =====================================================

-- -----------------------------------------------------
-- Drop tables in reverse order of dependencies
-- -----------------------------------------------------
DROP TABLE IF EXISTS password_reset_tokens CASCADE;
DROP TABLE IF EXISTS parent_communications CASCADE;
DROP TABLE IF EXISTS forum_posts CASCADE;
DROP TABLE IF EXISTS lesson_plans CASCADE;
DROP TABLE IF EXISTS teacher_tasks CASCADE;
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS learner_progress CASCADE;
DROP TABLE IF EXISTS sensory_toolkit_logs CASCADE;
DROP TABLE IF EXISTS learner_profiles CASCADE;
DROP TABLE IF EXISTS teacher_profiles CASCADE;
DROP TABLE IF EXISTS lesson_history CASCADE;
DROP TABLE IF EXISTS strategy_votes CASCADE;
DROP TABLE IF EXISTS community_strategies CASCADE;
DROP TABLE IF EXISTS ngo_reviews CASCADE;
DROP TABLE IF EXISTS ngos CASCADE;
DROP TABLE IF EXISTS curriculum_documents CASCADE;
DROP TABLE IF EXISTS teacher_classes CASCADE;
DROP TABLE IF EXISTS learners CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS schools CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP FUNCTION IF EXISTS set_updated_at() CASCADE;

-- -----------------------------------------------------
-- Utility trigger
-- -----------------------------------------------------
CREATE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------
-- Core tables
-- -----------------------------------------------------

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'teacher',
    school_name VARCHAR(255),
    province VARCHAR(100),
    city VARCHAR(100),
    phone VARCHAR(50),
    language_pref VARCHAR(20) DEFAULT 'English',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE schools (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    province VARCHAR(100),
    city VARCHAR(100),
    address TEXT,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    subscription_status VARCHAR(50) DEFAULT 'trial',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE classes (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
    class_name VARCHAR(100) NOT NULL,
    grade_level VARCHAR(50),
    academic_year INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE teacher_classes (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(teacher_id, class_id)
);

CREATE TABLE learners (
    id SERIAL PRIMARY KEY,
    class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
    pseudonym VARCHAR(100) NOT NULL,
    age_years INTEGER,
    support_needs TEXT,
    successful_strategies TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE curriculum_documents (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
    uploaded_by INTEGER REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    document_type VARCHAR(50),
    grade_level VARCHAR(50),
    subject VARCHAR(100),
    file_path VARCHAR(500),
    file_size INTEGER,
    extracted_text TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ngos (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    province VARCHAR(100),
    city VARCHAR(100),
    address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    services TEXT[],
    contact_phone VARCHAR(50),
    contact_email VARCHAR(255),
    website VARCHAR(255),
    rating DECIMAL(2, 1) DEFAULT 0,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ngo_reviews (
    id SERIAL PRIMARY KEY,
    ngo_id INTEGER REFERENCES ngos(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE community_strategies (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    challenge_type VARCHAR(100),
    description TEXT NOT NULL,
    grade_level VARCHAR(50),
    materials_needed TEXT,
    helpful_count INTEGER DEFAULT 0,
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE strategy_votes (
    id SERIAL PRIMARY KEY,
    strategy_id INTEGER REFERENCES community_strategies(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(strategy_id, user_id)
);

CREATE TABLE lesson_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    topic VARCHAR(255) NOT NULL,
    grade_level VARCHAR(50),
    adaptation_needs TEXT,
    generated_lesson TEXT,
    rating INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------
-- Frontend-specific tables
-- -----------------------------------------------------

CREATE TABLE teacher_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    title VARCHAR(20),
    name VARCHAR(100) NOT NULL,
    surname VARCHAR(100) NOT NULL,
    theme_preference VARCHAR(20) DEFAULT 'light',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE learner_profiles (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    anonymous_id VARCHAR(50) UNIQUE NOT NULL,
    profile_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sensory_toolkit_logs (
    id SERIAL PRIMARY KEY,
    learner_id INTEGER REFERENCES learner_profiles(id) ON DELETE CASCADE,
    teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    log_data JSONB NOT NULL,
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE learner_progress (
    id SERIAL PRIMARY KEY,
    learner_id INTEGER REFERENCES learner_profiles(id) ON DELETE CASCADE,
    teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    progress_data JSONB NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE activities (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE teacher_tasks (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    due_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lesson_plans (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE forum_posts (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE parent_communications (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    learner_id INTEGER REFERENCES learner_profiles(id) ON DELETE CASCADE,
    type VARCHAR(20) CHECK (type IN ('progress', 'concern')),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------
-- Triggers
-- -----------------------------------------------------

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER teacher_profiles_set_updated_at
BEFORE UPDATE ON teacher_profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER learner_profiles_set_updated_at
BEFORE UPDATE ON learner_profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER teacher_tasks_set_updated_at
BEFORE UPDATE ON teacher_tasks
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------
-- Indexes for performance
-- -----------------------------------------------------

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_ngos_province ON ngos(province);
CREATE INDEX idx_strategies_challenge ON community_strategies(challenge_type);
CREATE INDEX idx_learner_profiles_teacher ON learner_profiles(teacher_id);
CREATE INDEX idx_activities_teacher ON activities(teacher_id);
CREATE INDEX idx_lesson_plans_teacher ON lesson_plans(teacher_id);
CREATE INDEX idx_teacher_tasks_teacher ON teacher_tasks(teacher_id);
CREATE INDEX idx_teacher_tasks_status ON teacher_tasks(status);
CREATE INDEX idx_teacher_tasks_due_date ON teacher_tasks(due_date);
CREATE INDEX idx_forum_posts_created ON forum_posts(created_at);
CREATE INDEX idx_parent_communications_teacher ON parent_communications(teacher_id);
CREATE INDEX idx_sensory_logs_learner ON sensory_toolkit_logs(learner_id);
CREATE INDEX idx_learner_progress_learner ON learner_progress(learner_id);

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

INSERT INTO ngos (name, province, city, address, latitude, longitude, services, contact_phone, contact_email, website, rating, verified)
VALUES
(
    'Autism SA - Johannesburg',
    'Gauteng',
    'Johannesburg',
    '12 Support Street, Johannesburg',
    -26.20410300,
    28.04730500,
    ARRAY['Speech therapy', 'Occupational therapy', 'Parent workshops'],
    '011-345-6789',
    'joburg@autismsa.org',
    'https://www.autismsa.org',
    4.8,
    true
),
(
    'KZN Autism Centre',
    'KwaZulu-Natal',
    'Durban',
    '8 Coastline Drive, Durban',
    -29.85868000,
    31.02184000,
    ARRAY['Assessment', 'Social skills groups', 'Teacher training'],
    '031-765-4321',
    'info@kznautism.org',
    'https://www.kznautism.org',
    4.7,
    true
),
(
    'Cape Autism Network',
    'Western Cape',
    'Cape Town',
    '4 Inclusive Lane, Cape Town',
    -33.92487000,
    18.42405500,
    ARRAY['Early intervention', 'Family counseling'],
    '021-456-7890',
    'support@capeautism.org',
    'https://www.capeautism.org',
    4.9,
    true
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

-- End of schema
