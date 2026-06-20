const fs = require('fs');
const path = require('path');
const { pool, runSqlFile, closePool } = require('./db');

const migrationsDir = path.resolve(__dirname, '../database/migrations');

const ensureMigrationTable = async (client) => {
    await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            filename TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
    `);
};

const runMigrations = async () => {
    const client = await pool.connect();
    try {
        await ensureMigrationTable(client);

        const files = fs
            .readdirSync(migrationsDir)
            .filter((file) => file.endsWith('.sql'))
            .sort();

        for (const file of files) {
            const applied = await client.query(
                'SELECT 1 FROM schema_migrations WHERE filename = $1',
                [file]
            );

            if (applied.rows.length > 0) {
                continue;
            }

            console.log(`Applying migration ${file}...`);
            await client.query('BEGIN');
            await runSqlFile(client, path.join(migrationsDir, file));
            await client.query(
                'INSERT INTO schema_migrations (filename) VALUES ($1)',
                [file]
            );
            await client.query('COMMIT');
            console.log(`Applied migration ${file}.`);
        }
    } catch (error) {
        await client.query('ROLLBACK').catch(() => null);
        throw error;
    } finally {
        client.release();
    }
};

runMigrations()
    .catch((error) => {
        console.error('Database migration failed:', error);
        process.exitCode = 1;
    })
    .finally(closePool);
