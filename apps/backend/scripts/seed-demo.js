const path = require('path');
const { pool, runSqlFile, closePool } = require('./db');

// Development-only sample data. Refuses to run in production or without an explicit opt-in,
// so a shared demo account with a known password never reaches a real database.
const seedPath = path.resolve(__dirname, '../../../docs/database/demo_seed.sql');

const seed = async () => {
    if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEMO_SEED !== 'true') {
        console.error('Refusing to seed: set ALLOW_DEMO_SEED=true outside production.');
        process.exitCode = 1;
        return;
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await runSqlFile(client, seedPath);
        await client.query('COMMIT');
        console.log('Demo seed loaded.');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => null);
        throw error;
    } finally {
        client.release();
    }
};

seed()
    .catch((error) => {
        console.error('Demo seed failed:', error);
        process.exitCode = 1;
    })
    .finally(closePool);
