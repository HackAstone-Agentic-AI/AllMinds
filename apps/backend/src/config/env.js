const isPlaceholder = (value = '') => {
    const normalized = String(value).trim().toLowerCase();
    return (
        normalized === '' ||
        normalized.includes('your_') ||
        normalized.includes('change-this') ||
        normalized.includes('example') ||
        normalized === 'undefined' ||
        normalized === 'null'
    );
};

const validateEnv = () => {
    const required = ['JWT_SECRET'];

    if (isPlaceholder(process.env.DATABASE_URL)) {
        required.push('DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME');
    }

    const missingRequired = required.filter((key) => isPlaceholder(process.env[key]));

    if (missingRequired.length > 0) {
        throw new Error(`Missing required environment variables: ${missingRequired.join(', ')}`);
    }

    const oauthProviders = [
        { name: 'google', vars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] },
        { name: 'microsoft', vars: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'] },
        { name: 'apple', vars: ['APPLE_CLIENT_ID', 'APPLE_CLIENT_SECRET'] },
    ];

    const configuredProviders = [];

    for (const provider of oauthProviders) {
        const values = provider.vars.map((key) => process.env[key]);
        const presentCount = values.filter((value) => !isPlaceholder(value)).length;

        if (presentCount === provider.vars.length) {
            configuredProviders.push(provider.name);
        } else if (presentCount > 0) {
            console.warn(
                `[env] ${provider.name} OAuth is partially configured. Set ${provider.vars.join(', ')} to enable it.`
            );
        }
    }

    if (isPlaceholder(process.env.FRONTEND_URL)) {
        process.env.FRONTEND_URL = 'http://localhost:3000';
        console.warn('[env] FRONTEND_URL not set. Defaulting to http://localhost:3000');
    }

    if (isPlaceholder(process.env.BACKEND_URL)) {
        process.env.BACKEND_URL = 'http://localhost:5000';
        console.warn('[env] BACKEND_URL not set. Defaulting to http://localhost:5000');
    }

    if (isPlaceholder(process.env.AGENTIC_AI_URL)) {
        process.env.AGENTIC_AI_URL = 'http://127.0.0.1:8000';
        console.warn('[env] AGENTIC_AI_URL not set. Defaulting to http://127.0.0.1:8000');
    }

    if (isPlaceholder(process.env.GROQ_API_KEY)) {
        console.warn('[env] GROQ_API_KEY is not set in this environment. Ensure the agent service has it before using agent chat.');
    }

    const emailVariables = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_FROM'];
    const missingEmailVariables = emailVariables.filter((key) => isPlaceholder(process.env[key]));
    const hasEmailUser = !isPlaceholder(process.env.EMAIL_USER);
    const hasEmailPass = !isPlaceholder(process.env.EMAIL_PASS);
    if (missingEmailVariables.length > 0 || hasEmailUser !== hasEmailPass) {
        console.warn(
            `[env] Email delivery is incomplete. Check ${[
                ...missingEmailVariables,
                ...(hasEmailUser !== hasEmailPass ? ['EMAIL_USER', 'EMAIL_PASS'] : []),
            ].join(', ')}.`
        );
    }

    const bcryptRounds = Number(process.env.BCRYPT_ROUNDS || 10);
    if (!Number.isInteger(bcryptRounds) || bcryptRounds < 8 || bcryptRounds > 15) {
        throw new Error('BCRYPT_ROUNDS must be an integer between 8 and 15');
    }

    return { configuredProviders };
};

module.exports = { validateEnv, isPlaceholder };
