// Integration tests against a real PostgreSQL database that has the baseline schema and
// all migrations applied (DB_NAME, e.g. allminds_test). A fake agent service stands in
// for the Python agents so the proxy paths can be tested without LLM keys.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-0123456789abcdef0123456789abcdef';
process.env.AUTH_RATE_LIMIT_MAX = '1000';

let fakeAgentRequests = [];
const fakeAgent = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
        fakeAgentRequests.push({ url: req.url, method: req.method, body: body ? JSON.parse(body) : null, auth: req.headers.authorization });
        if (req.url === '/chat/stream') {
            res.writeHead(200, { 'Content-Type': 'text/event-stream' });
            res.write('data: {"type":"token","text":"Hello "}\n\n');
            res.end('data: {"type":"done","status":"success","response":"Hello teacher"}\n\n');
            return;
        }
        if (req.url === '/memory') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(req.method === 'DELETE' ? { status: 'deleted' } : { turns: [], facts: ['x'] }));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success', response: 'ok', agent: 'lesson', cached: false }));
    });
});

let base;
let server;
let pool;

const call = async (method, path, { token, body } = {}) => {
    const res = await fetch(`${base}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* streamed or empty body */ }
    return { status: res.status, json, text };
};

const newTeacher = async (label) => {
    const email = `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@example.com`;
    const reg = await call('POST', '/api/auth/register', { body: { email, password: 'password123', full_name: 'Test Teacher' } });
    assert.equal(reg.status, 201, reg.text);
    const login = await call('POST', '/api/auth/login', { body: { email, password: 'password123' } });
    assert.equal(login.status, 200, login.text);
    return login.json.token;
};

test.before(async () => {
    await new Promise((resolve) => fakeAgent.listen(0, resolve));
    process.env.AGENTIC_AI_URL = `http://127.0.0.1:${fakeAgent.address().port}`;
    const app = require('../src/app');
    pool = require('../src/config/database');
    await new Promise((resolve) => { server = app.listen(0, resolve); });
    base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => fakeAgent.close(resolve));
    await pool.end();
});

test('R2: a profile without first name or surname can be stored', async () => {
    const user = await pool.query(
        "INSERT INTO users (email, password_hash, full_name) VALUES ($1, '', 'Mononym') RETURNING id",
        [`mono.${Date.now()}@example.com`]
    );
    await pool.query('INSERT INTO teacher_profiles (user_id, name, surname) VALUES ($1, $2, NULL)', [user.rows[0].id, 'Mononym']);
});

test('W5: demo classroom loads once, carries real analytics fields, and can be removed', async () => {
    const token = await newTeacher('demo');
    const first = await call('POST', '/api/demo/classroom', { token });
    assert.equal(first.status, 201);
    assert.equal((await call('POST', '/api/demo/classroom', { token })).status, 409);
    const learners = (await call('GET', '/api/learners', { token })).json;
    assert.equal(learners.length, 10);
    const progress = (await call('GET', `/api/learners/${learners[0].id}/progress`, { token })).json;
    assert.equal(progress.length, 8);
    assert.match(progress[0].progress_data.engagementLevel, /^[1-5]$/);
    const removed = await call('DELETE', '/api/demo/classroom', { token });
    assert.equal(removed.json.learners, 10);
    assert.equal((await call('GET', '/api/learners', { token })).json.length, 0);
});

test('W1: progress records validate and store engagement, completion and attendance', async () => {
    const token = await newTeacher('progress');
    const learner = (await call('POST', '/api/learners', { token, body: { anonymous_id: 'P-1', profile_data: {} } })).json;
    const bad = await call('POST', `/api/learners/${learner.id}/progress`, { token, body: { area: 'Reading', level: 'Good', engagementLevel: '9' } });
    assert.equal(bad.status, 400);
    const ok = await call('POST', `/api/learners/${learner.id}/progress`, {
        token, body: { area: 'Reading', level: 'Good', engagementLevel: '4', taskCompletionLevel: '3', attendance: 'present' },
    });
    assert.equal(ok.status, 201);
    const rows = (await call('GET', `/api/learners/${learner.id}/progress`, { token })).json;
    assert.equal(rows[0].progress_data.engagementLevel, '4');
    assert.equal(rows[0].progress_data.attendance, 'present');
});

test('X3: attention list ranks declining learners with reasons', async () => {
    const token = await newTeacher('attention');
    await call('POST', '/api/demo/classroom', { token });
    const res = await call('GET', '/api/learners/attention', { token });
    assert.equal(res.status, 200);
    assert.ok(res.json.learners.length > 0 && res.json.learners.length <= 5);
    const scores = res.json.learners.map((l) => l.score);
    assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
    assert.ok(res.json.learners[0].reasons.length > 0);
});

test('W3: forum allows the word "students" but blocks phone numbers in posts and comments', async () => {
    const token = await newTeacher('forum');
    const ok = await call('POST', '/api/forum', { token, body: { title: 'Students and timers', content: 'My students like visual timers.' } });
    assert.equal(ok.status, 201, ok.text);
    const bad = await call('POST', '/api/forum', { token, body: { title: 'Contact', content: 'Phone me on 082 123 4567' } });
    assert.equal(bad.status, 400);
    assert.match(bad.json.error, /phone number/);
    const comment = await call('POST', `/api/forum/${ok.json.id}/comments`, { token, body: { content: 'Email a@b.co.za' } });
    assert.equal(comment.status, 400);
});

test('W4: NGO search ranks by distance and need, hides placeholders, supports reviews and reports', async () => {
    const res = await call('GET', '/api/ngos?lat=-29.85&lng=31.02&need=autism%20diagnosis');
    assert.equal(res.status, 200);
    assert.ok(res.json.count >= 10);
    assert.equal(res.json.ngos[0].name, 'Action in Autism');
    assert.ok(res.json.ngos.every((n) => n.source_url && n.last_checked));
    assert.ok(!res.json.ngos.some((n) => n.name === 'KZN Autism Centre'));
    const gauteng = await call('GET', '/api/ngos?province=Gauteng');
    assert.ok(gauteng.json.ngos.every((n) => n.province === 'Gauteng' || n.coverage === 'national'));

    const token = await newTeacher('ngo');
    const id = res.json.ngos[0].id;
    assert.equal((await call('POST', `/api/ngos/${id}/review`, { token, body: { rating: 6 } })).status, 400);
    assert.equal((await call('POST', `/api/ngos/${id}/review`, { token, body: { rating: 4, comment: 'call 0821234567' } })).status, 400);
    assert.equal((await call('POST', `/api/ngos/${id}/review`, { token, body: { rating: 4, comment: 'Helpful' } })).status, 201);
    assert.equal((await call('POST', `/api/ngos/${id}/report`, { token, body: { issue: 'Phone is out of date' } })).status, 201);
    const training = await call('GET', '/api/ngos/training');
    assert.ok(training.json.length >= 7 && training.json.every((t) => t.url.startsWith('https://')));
});

test('W12: strategy library shows own pending submissions only to the author', async () => {
    const token = await newTeacher('strategy');
    const invalid = await call('POST', '/api/strategies', { token, body: { title: 'x', description: 'y', challenge_type: 'nonsense' } });
    assert.equal(invalid.status, 400);
    const created = await call('POST', '/api/strategies', { token, body: { title: 'Role cards', description: 'Give each learner a role card', challenge_type: 'social' } });
    assert.equal(created.status, 201);
    const mine = (await call('GET', '/api/strategies', { token })).json.strategies;
    assert.ok(mine.some((s) => s.title === 'Role cards' && s.is_mine && !s.is_approved));
    const anonymous = (await call('GET', '/api/strategies')).json.strategies;
    assert.ok(!anonymous.some((s) => s.title === 'Role cards'));
    assert.ok(anonymous.some((s) => s.author_name === 'AllMinds starter library'));
    const starter = anonymous.find((s) => s.author_name === 'AllMinds starter library');
    assert.equal((await call('POST', `/api/strategies/${starter.id}/vote`, { token })).status, 200);
    assert.equal((await call('POST', `/api/strategies/${starter.id}/vote`, { token })).status, 409);
    assert.ok((await call('GET', '/api/strategies', { token })).json.strategies.find((s) => s.id === starter.id).user_voted);
    assert.equal((await call('PATCH', `/api/strategies/${created.json.strategy.id}/approve`, { token })).status, 403);
});

test('W13: bulk upload strips phone and ID values server-side', async () => {
    const token = await newTeacher('upload');
    const res = await call('POST', '/api/learners/bulk', {
        token,
        body: { learners: [{ anonymous_id: 'U-1', profile_data: { pseudonym: 'Learner A', guardian: '082 123 4567', idno: '0102035009087', grade: 'Grade 2' } }] },
    });
    assert.equal(res.status, 201, res.text);
    assert.equal(res.json.pii_values_removed, 2);
    const stored = (await call('GET', '/api/learners', { token })).json[0].profile_data;
    assert.deepEqual(Object.keys(stored).sort(), ['grade', 'pseudonym']);
});

test('W7: calendar events validate date and recurrence before touching Google', async () => {
    const token = await newTeacher('calendar');
    const badRepeat = await call('POST', '/api/calendar/events', { token, body: { title: 'Reading', start_time: '09:00', recurrence: 'hourly' } });
    assert.equal(badRepeat.status, 400);
    const badDate = await call('POST', '/api/calendar/events', { token, body: { title: 'Reading', start_time: '09:00', date: '31/10/2026' } });
    assert.equal(badDate.status, 400);
    const notConnected = await call('POST', '/api/calendar/events', { token, body: { title: 'Reading', start_time: '09:00', recurrence: 'weekdays' } });
    assert.ok([409, 503].includes(notConnected.status), notConnected.text);
});

test('Agent proxy: forwards with the user as thread, records usage, streams and proxies memory', async () => {
    const token = await newTeacher('agent');
    fakeAgentRequests = [];
    const chat = await call('POST', '/api/agent/chat', { token, body: { message: 'plan', tool_hint: 'lesson', thread_id: 'spoofed', language_pref: 'zu' } });
    assert.equal(chat.status, 200);
    assert.notEqual(fakeAgentRequests[0].body.thread_id, 'spoofed');
    await new Promise((resolve) => setTimeout(resolve, 100)); // usage insert is fire-and-forget
    const impact = (await call('GET', '/api/stats/impact', { token })).json;
    assert.equal(impact.lessonPlans, 1);
    assert.deepEqual(impact.languagesUsed, ['zu']);
    assert.ok(impact.hoursSaved > 0);

    const stream = await call('POST', '/api/agent/chat/stream', { token, body: { message: 'hi' } });
    assert.equal(stream.status, 200);
    assert.match(stream.text, /"type":"token"/);
    assert.match(stream.text, /"type":"done"/);

    assert.deepEqual((await call('GET', '/api/agent/memory', { token })).json.facts, ['x']);
    assert.equal((await call('DELETE', '/api/agent/memory', { token })).json.status, 'deleted');
    assert.equal((await call('GET', '/api/agent/memory')).status, 401);
});

test('Admin stats require the admin role', async () => {
    const token = await newTeacher('admin');
    assert.equal((await call('GET', '/api/stats/admin', { token })).status, 403);
});

// ── Failed cases from All_Minds_AI_Testing_Report_3 ──────────────────────────

test('TC-LPM-003: an empty upload is rejected', async () => {
    const token = await newTeacher('lpm3');
    const res = await call('POST', '/api/learners/bulk', { token, body: { learners: [] } });
    assert.equal(res.status, 400);
});

test('TC-LPM-004: rows without a learner ID or name are rejected and reported', async () => {
    const token = await newTeacher('lpm4');
    const res = await call('POST', '/api/learners/bulk', {
        token,
        body: {
            learners: [
                { anonymous_id: 'L-1', profile_data: { pseudonym: 'Learner A' } },
                { profile_data: { grade: 'Grade 3' } },
                { anonymous_id: 'L-3', profile_data: { grade: 'Grade 1' } },
                { profile_data: { pseudonym: 'Learner D' } },
            ],
        },
    });
    assert.equal(res.status, 201, res.text);
    assert.equal(res.json.inserted, 3);
    assert.deepEqual(res.json.invalid_rows, [2]);
    assert.match(res.json.message, /1 row without a learner ID or name rejected/);
    const all = await call('POST', '/api/learners/bulk', { token, body: { learners: [{ profile_data: { grade: 'Grade 3' } }] } });
    assert.equal(all.status, 400);
});

test('TC-LPM-005: duplicate learner IDs are skipped and reported', async () => {
    const token = await newTeacher('lpm5');
    const rows = [
        { anonymous_id: 'D-1', profile_data: { pseudonym: 'A' } },
        { anonymous_id: 'D-2', profile_data: { pseudonym: 'B' } },
        { anonymous_id: 'D-1', profile_data: { pseudonym: 'A again' } },
    ];
    const first = await call('POST', '/api/learners/bulk', { token, body: { learners: rows } });
    assert.equal(first.json.inserted, 2);
    assert.match(first.json.message, /1 duplicate skipped/);
    const again = await call('POST', '/api/learners/bulk', { token, body: { learners: rows } });
    assert.equal(again.json.inserted, 0);
    assert.equal((await call('GET', '/api/learners', { token })).json.length, 2);
});

test('TC-SCH-006: a second schedule item for the same learner and time is rejected', async () => {
    const token = await newTeacher('sch6');
    const learner = (await call('POST', '/api/learners', { token, body: { anonymous_id: 'S-1', profile_data: {} } })).json;
    const item = { learner_id: learner.id, title: 'Reading', start_time: '09:00' };
    assert.equal((await call('POST', '/api/activities/schedule-items', { token, body: item })).status, 201);
    const duplicate = await call('POST', '/api/activities/schedule-items', { token, body: { ...item, title: 'Maths' } });
    assert.equal(duplicate.status, 409);
    assert.match(duplicate.json.error, /already exists at that time/);
    const other = (await call('POST', '/api/activities/schedule-items', { token, body: { ...item, start_time: '10:00' } })).json;
    const moved = await call('PATCH', `/api/activities/schedule-items/${other.id}`, { token, body: { start_time: '09:00' } });
    assert.equal(moved.status, 409);
});
