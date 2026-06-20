-- Replace the global unique constraint on anonymous_id with a per-teacher constraint.
-- Previously, two teachers could not share the same anonymous_id, causing silent data
-- loss on bulk upload. The correct scope is (teacher_id, anonymous_id).

-- Drop the old single-column constraint if it exists
ALTER TABLE learner_profiles
    DROP CONSTRAINT IF EXISTS learner_profiles_anonymous_id_key;

-- Add the scoped composite unique constraint
ALTER TABLE learner_profiles
    ADD CONSTRAINT learner_profiles_teacher_anonymous_unique
    UNIQUE (teacher_id, anonymous_id);
