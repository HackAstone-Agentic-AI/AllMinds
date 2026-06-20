const path = require('path');
const { pool, runSqlFile, closePool } = require('./db');

const schemaPath = path.resolve(__dirname, '../../../docs/database/allminds_complete_schema.sql');

const initDb = async () => {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'users'
            ) AS exists
        `);

        if (result.rows[0]?.exists) {
            console.log('Database baseline already exists; skipping schema bootstrap.');
            return;
        }

        console.log('Bootstrapping database from docs/database/allminds_complete_schema.sql...');
        await runSqlFile(client, schemaPath);
        console.log('Database bootstrap completed.');
    } finally {
        client.release();
    }
};

initDb()
    .catch((error) => {
        console.error('Database bootstrap failed:', error);
        process.exitCode = 1;
    })
    .finally(closePool);
