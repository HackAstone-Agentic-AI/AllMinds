-- Starter strategies so the community library is useful on day one. They have no
-- author (user_id NULL) and are shown as "AllMinds starter library".
CREATE UNIQUE INDEX IF NOT EXISTS uq_community_strategies_starter_title
    ON community_strategies(title) WHERE user_id IS NULL;

INSERT INTO community_strategies (user_id, title, challenge_type, description, grade_level, materials_needed, helpful_count, is_approved)
SELECT NULL, v.title, v.challenge_type, v.description, v.grade_level, v.materials_needed, 0, true
FROM (VALUES
    ('Visual countdown before transitions', 'transitions',
     'Show a visual timer and give 5- and 1-minute warnings before every change of activity. Pair with a picture of what comes next so the learner can see the change coming.',
     'Grade R-3', 'Sand or visual timer, picture cards'),
    ('First-then board', 'transitions',
     'Show two pictures: the task first, then a preferred activity. Keep language short ("First reading, then blocks") and point to each card as you say it.',
     'Grade R-3', 'Laminated board, two picture cards'),
    ('Movement break menu', 'attention',
     'Offer a choice of 2-minute movement breaks (wall push-ups, carrying books, stretching) at planned points in long lessons, not only when a learner is already dysregulated.',
     'All grades', 'Picture menu of movement breaks'),
    ('Quiet corner for sensory regulation', 'sensory',
     'Set up a low-light, low-noise corner with headphones and a calm-down card. Teach when and how to use it on a calm day, and let learners request it with a card or gesture.',
     'All grades', 'Cushion, ear defenders, calm-down cards'),
    ('Chunked instructions with checkboxes', 'attention',
     'Break a task into 3-5 single-action steps, written or drawn on a strip the learner can tick off. Give the next step only after the previous one is done.',
     'Grade 1-7', 'Task strips, pencil or stickers'),
    ('Coloured overlays and larger spacing for reading', 'literacy',
     'Offer a choice of coloured overlay or reading ruler, larger font and extra line spacing. Let the learner pick what helps; reduce copying from the board.',
     'Grade 1-7', 'Overlays, reading rulers, enlarged texts'),
    ('Concrete manipulatives before symbols', 'numeracy',
     'Teach number concepts with blocks, bead strings or fraction strips first, then pictures, then symbols (concrete-pictorial-abstract). Keep manipulatives available during tests.',
     'Grade R-4', 'Counting blocks, bead strings, fraction strips'),
    ('Choice-based requests (low-demand phrasing)', 'behaviour',
     'For learners who resist direct demands, offer two acceptable choices ("Do you want to start with the red or blue worksheet?") and use declarative language instead of commands.',
     'All grades', 'None')
) AS v(title, challenge_type, description, grade_level, materials_needed)
WHERE NOT EXISTS (
    SELECT 1 FROM community_strategies cs WHERE cs.user_id IS NULL AND cs.title = v.title
);
