const test = require('node:test');
const assert = require('node:assert/strict');
const { findPii } = require('../src/utils/pii');

test('PII filter allows ordinary teaching words', () => {
    for (const text of [
        'My students love visual timers',
        'How do I rename my username?',
        'Grade 3 has 25 students and a name chart',
        'Use the address book activity in Grade 2',
    ]) {
        assert.deepEqual(findPii(text), [], text);
    }
});

test('PII filter catches identifiers', () => {
    assert.deepEqual(findPii('Call me on 082 123 4567'), ['a phone number']);
    assert.deepEqual(findPii('+27 82 123 4567'), ['a phone number']);
    assert.deepEqual(findPii('mail t@x.co.za'), ['an e-mail address']);
    assert.deepEqual(findPii('ID 0102035009087'), ['an ID number']);
    assert.deepEqual(findPii('lives at 12 Main Street'), ['a street address']);
    assert.deepEqual(findPii('my learner named Sipho Dlamini'), ["a child's full name"]);
});
