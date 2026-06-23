const app = require('./src/app');
const pool = require('./src/config/database');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
});

const shutdown = (signal) => {
    console.log(`${signal} received — shutting down gracefully`);
    server.close(async () => {
        try {
            await pool.end();
        } catch (_) {}
        process.exit(0);
    });
    setTimeout(() => {
        console.error('Graceful shutdown timed out — forcing exit');
        process.exit(1);
    }, 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    shutdown('uncaughtException');
});
