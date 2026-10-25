-- The old baseline schema seeded a shared demo account with a password hash committed
-- to the repository. Deactivate it on existing databases; teachers now use the
-- per-account "Load demo classroom" feature instead. Development seeds are loaded
-- separately (npm run db:seed-demo) after migrations, so they are unaffected.
UPDATE users SET is_active = false WHERE email = 'teacher.demo@allminds.org';
