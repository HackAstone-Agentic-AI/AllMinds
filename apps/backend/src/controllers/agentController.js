const { Readable } = require('stream');
const { isPlaceholder } = require('../config/env');
const pool = require('../config/database');

const DEFAULT_AGENTIC_AI_URL = 'http://127.0.0.1:8000';

const getAgentServiceUrl = () => {
    const configuredUrl = process.env.AGENTIC_AI_URL;
    return isPlaceholder(configuredUrl) ? DEFAULT_AGENTIC_AI_URL : configuredUrl;
};

// Records which tool produced a result (no prompt or response text) for the impact summary.
const recordUsage = (teacherId, tool, language) => {
    pool.query(
        'INSERT INTO ai_usage (teacher_id, tool, language_pref) VALUES ($1, $2, $3)',
        [teacherId, String(tool || 'chat').slice(0, 30), String(language || 'en').slice(0, 10)]
    ).catch((err) => console.error('AI usage logging failed:', err.message));
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
            signal: AbortSignal.timeout(180_000),
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

        if (data && typeof data === 'object' && data.status === 'success' && !data.cached) {
            recordUsage(req.user.id, data.agent || req.body?.tool_hint, req.body?.language_pref);
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

// Streams Thandi's reply (server-sent events) from the agent service to the browser.
const proxyAgentChatStream = async (req, res) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180_000);
    // Stop the upstream generation if the teacher closes the chat.
    req.on('close', () => controller.abort());
    try {
        const upstream = await fetch(`${getAgentServiceUrl()}/chat/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
            },
            body: JSON.stringify({
                ...(req.body && typeof req.body === 'object' ? req.body : {}),
                thread_id: String(req.user.id),
            }),
            signal: controller.signal,
        });

        if (!upstream.ok || !upstream.body) {
            const data = await upstream.json().catch(() => null);
            return res.status(upstream.status || 502).json({
                error: data && data.detail ? String(data.detail) : 'Agent service request failed.',
            });
        }

        res.status(200);
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();
        recordUsage(req.user.id, 'chat', req.body?.language_pref);
        Readable.fromWeb(upstream.body).pipe(res);
    } catch (error) {
        if (!res.headersSent) {
            const timedOut = error?.name === 'AbortError' || error?.name === 'TimeoutError';
            res.status(502).json({
                error: timedOut ? 'The AI request timed out. Please try again.' : 'Unable to reach the agent service.',
            });
        } else {
            res.end();
        }
    } finally {
        clearTimeout(timeout);
    }
};

// GET returns Thandi's remembered conversation/facts; DELETE erases them.
const proxyAgentMemory = async (req, res) => {
    try {
        const upstream = await fetch(`${getAgentServiceUrl()}/memory`, {
            method: req.method,
            headers: req.headers.authorization ? { Authorization: req.headers.authorization } : {},
            signal: AbortSignal.timeout(30_000),
        });
        const data = await upstream.json().catch(() => null);
        if (!upstream.ok) {
            return res.status(upstream.status).json({ error: data?.detail ? String(data.detail) : 'Agent service request failed.' });
        }
        return res.json(data);
    } catch (error) {
        return res.status(502).json({ error: 'Unable to reach the agent service.' });
    }
};

module.exports = { proxyAgentChat, proxyAgentChatStream, proxyAgentMemory };
