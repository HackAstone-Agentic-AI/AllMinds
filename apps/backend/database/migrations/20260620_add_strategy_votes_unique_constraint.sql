-- Add a named unique constraint on strategy_votes so that ON CONFLICT ON CONSTRAINT
-- can reference it explicitly. Without this constraint, ON CONFLICT DO NOTHING is a
-- no-op and duplicate votes silently inflate helpful_count.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'strategy_votes_strategy_user_unique'
    ) THEN
        ALTER TABLE strategy_votes
            ADD CONSTRAINT strategy_votes_strategy_user_unique
            UNIQUE (strategy_id, user_id);
    END IF;
END $$;
