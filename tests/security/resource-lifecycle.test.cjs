const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setTimeout: pause } = require('node:timers/promises');
const { mapConcurrent } = require('../../functions/concurrency');
const { metadataList } = require('../../functions/metadata');
const { ensureQuestionView } = require('../../functions/question-view');
const { createHttpApi } = require('../../functions/http-api');

test('worker pool preserves ordering, bounds concurrency and drains failures', async () => {
  let active = 0, maximum = 0;
  const out = await mapConcurrent(Array.from({ length: 200 }, (_, i) => i), 4, async i => {
    maximum = Math.max(maximum, ++active); await pause(i % 3); active--; return i * 2;
  });
  assert.equal(maximum, 4); assert.equal(active, 0);
  assert.deepEqual(out, Array.from({ length: 200 }, (_, i) => i * 2));
  let started = 0, finished = 0;
  await assert.rejects(mapConcurrent([0, 1, 2, 3, 4], 2, async i => {
    started++; if (!i) throw new Error('failure'); await pause(20); finished++;
  }), /failure/);
  assert.equal(started, 2); assert.equal(finished, 1);
  await assert.rejects(mapConcurrent([1], 0, () => {}), RangeError);
});

test('metadata list keeps all rows and fields with at most 16 reads in flight', async () => {
  let active = 0, maximum = 0;
  const db = { ref: path => ({ get: async () => {
    maximum = Math.max(maximum, ++active); await pause(1); active--; return { val: () => path };
  } }) };
  const ids = Array.from({ length: 30 }, (_, i) => `row${i}`);
  const fields = Array.from({ length: 36 }, (_, i) => `field${i}`);
  const rows = await metadataList(db, 'questions', fields, ids);
  assert.equal(maximum, 16); assert.equal(active, 0); assert.equal(rows.length, 30);
  assert.equal(rows[29].field35, 'questions/row29/field35');
});

test('question-view preparation coalesces callers and preserves a newer publication', async () => {
  let scans = 0, transactions = 0, published = null;
  const original = { type: 'quiz', title: 'old', correctAnswer: 'secret', hints: ['hidden'] };
  const target = { orderByKey() { return this; }, limitToFirst(value) { assert.equal(value, 1); return this; },
    get: async () => ({ exists: () => false }), transaction: async transform => {
      transactions++; published = { newer: { title: 'teacher published' } };
      const next = transform(published); if (next !== undefined) published = next;
    } };
  const db = { app: { options: { databaseURL: 'https://demo-resource.firebaseio.com' } },
    ref: path => path.endsWith('/publicQuestions') ? target : ({ get: async () => ({ val: () => original[path.split('/').at(-1)] ?? null }) }) };
  const previousHost = process.env.FIREBASE_DATABASE_EMULATOR_HOST, previousFetch = global.fetch;
  process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000';
  global.fetch = async () => { scans++; await pause(10); return { ok: true, json: async () => ({ q: true }) }; };
  try {
    await Promise.all(Array.from({ length: 20 }, () => ensureQuestionView(db, 'room')));
    assert.equal(scans, 1); assert.equal(transactions, 1);
    assert.deepEqual(published, { newer: { title: 'teacher published' } });
    // 완료된 promise는 보관하지 않고 다음 확인을 수행한다.
    await ensureQuestionView(db, 'room'); assert.equal(scans, 2);
  } finally {
    global.fetch = previousFetch;
    if (previousHost == null) delete process.env.FIREBASE_DATABASE_EMULATOR_HOST;
    else process.env.FIREBASE_DATABASE_EMULATOR_HOST = previousHost;
  }
});

test('question-view keeps the answer image out of the public view until the answer is revealed', async () => {
  const project = async original => {
    let published = null;
    const target = { orderByKey() { return this; }, limitToFirst() { return this; },
      get: async () => ({ exists: () => false }), transaction: async transform => { published = transform(null); } };
    const db = { app: { options: { databaseURL: 'https://demo-resource.firebaseio.com' } },
      ref: path => path.endsWith('/publicQuestions') ? target : ({ get: async () => ({ val: () => original[path.split('/').at(-1)] ?? null }) }) };
    await ensureQuestionView(db, 'answer-image-room');
    return published.q;
  };
  const previousHost = process.env.FIREBASE_DATABASE_EMULATOR_HOST, previousFetch = global.fetch;
  process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000';
  global.fetch = async () => ({ ok: true, json: async () => ({ q: true }) });
  try {
    const original = { type: 'ox', title: 'earth', correctAnswer: 'O', answerImageUrl: 'https://img.example/earth.jpg', answerExplanation: 'seen from orbit' };
    const hidden = await project(original);
    assert.equal(hidden.title, 'earth');
    assert.equal(hidden.answerImageUrl, undefined); assert.equal(hidden.correctAnswer, undefined); assert.equal(hidden.answerExplanation, undefined);
    const shown = await project({ ...original, revealedAt: 1 });
    assert.equal(shown.answerImageUrl, 'https://img.example/earth.jpg'); assert.equal(shown.correctAnswer, 'O'); assert.equal(shown.answerExplanation, 'seen from orbit');
  } finally {
    global.fetch = previousFetch;
    if (previousHost == null) delete process.env.FIREBASE_DATABASE_EMULATOR_HOST;
    else process.env.FIREBASE_DATABASE_EMULATOR_HOST = previousHost;
  }
});

test('oversized raw and parsed API bodies are rejected before calling the service', async () => {
  let calls = 0;
  const handler = createHttpApi(async () => { calls++; return { ok: true }; }, { emulator: true, maxBodyBytes: 64 });
  const request = body => ({ method: 'POST', ip: 'local-test', get: () => 'http://127.0.0.1:5175', body });
  const response = () => ({ set() {}, status(value) { this.code = value; return this; }, json(value) { this.body = value; return this; } });
  const raw = request({}); raw.rawBody = Buffer.alloc(65);
  const a = response(); await handler(raw, a); assert.equal(a.code, 413);
  const b = response(); await handler(request({ value: 'a'.repeat(65) }), b); assert.equal(b.code, 413);
  assert.equal(calls, 0);
  const c = response(); await handler(request({ value: 'ok' }), c); assert.equal(c.code, 200); assert.equal(calls, 1);
});

const { EventEmitter } = require('node:events');
const { fetchUpstream } = require('../../functions/upstream');
test('proxy aborts on disconnect and releases its close listener after completion', async () => {
  const previousFetch = global.fetch;
  const response = new EventEmitter(); let signal;
  global.fetch = async (_url, options) => {
    signal = options.signal;
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('stopped')), { once: true }));
  };
  try {
    const work = fetchUpstream('https://example.invalid', {}, response, { timeoutMs: 500 });
    response.emit('close'); await assert.rejects(work, /stopped/);
    assert.equal(signal.aborted, true); assert.equal(response.listenerCount('close'), 0);
    global.fetch = async () => new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } });
    const result = await fetchUpstream('https://example.invalid', {}, response);
    assert.equal(result.text, '{"ok":true}'); assert.equal(response.listenerCount('close'), 0);
    global.fetch = async () => new Response('a'.repeat(101));
    await assert.rejects(fetchUpstream('https://example.invalid', {}, response, { maxBytes: 100 }), /크기 초과/);
    assert.equal(response.listenerCount('close'), 0);
  } finally { global.fetch = previousFetch; }
});
