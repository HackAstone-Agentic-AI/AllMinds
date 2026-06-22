const { isPlaceholder } = require('../config/env');

const DEFAULT_AGENTIC_AI_URL = 'http://127.0.0.1:8000';

const getAgentServiceUrl = () => {
    const configuredUrl = process.env.AGENTIC_AI_URL;
    return isPlaceholder(configuredUrl) ? DEFAULT_AGENTIC_AI_URL : configuredUrl;
};

const proxyAgentChat = async (req, res) => {
    try {
        const payload = {
            ...(req.body && typeof req.body === 'object' ? req.body : {}),
            thread_id: String(req.user.id),
        };

        const upstream = await fetch(`${getAgentServiceUrl()}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(req.headers.authorization
                    ? { Authorization: req.headers.authorization }
                    : {}),
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(45_000),
        });

        const contentType = upstream.headers.get('content-type') || '';
        const data = contentType.includes('application/json')
            ? await upstream.json().catch(() => null)
            : await upstream.text().catch(() => null);

        if (!upstream.ok) {
            const errorMessage =
                data && typeof data === 'object' && 'detail' in data
                    ? String(data.detail)
                    : typeof data === 'string' && data.trim()
                        ? data
                        : 'Agent service request failed.';

            return res.status(upstream.status).json({ error: errorMessage });
        }

        return res.status(upstream.status).json(data);
    } catch (error) {
        const timedOut = error?.name === 'TimeoutError';
        return res.status(502).json({
            error: timedOut
                ? 'The AI request timed out. Please try again.'
                : 'Unable to reach the agent service.',
        });
    }
};

module.exports = { proxyAgentChat };
