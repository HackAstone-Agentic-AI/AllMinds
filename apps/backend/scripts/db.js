const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const pool = new Pool(
    process.env.DATABASE_URL
        ? {
            connectionString: process.env.DATABASE_URL,
            ssl:
                process.env.DATABASE_SSL === 'false'
                    ? false
                    : { rejectUnauthorized: false },
        }
        : {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        }
);

const runSqlFile = async (client, filePath) => {
    const sql = fs.readFileSync(filePath, 'utf8');
    if (sql.trim()) {
        await client.query(sql);
    }
};

const closePool = () => pool.end();

module.exports = {
    pool,
    runSqlFile,
    closePool,
};
