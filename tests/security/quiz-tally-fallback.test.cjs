// 퀴즈 집계 서버 예비 경로를 실제 Admin SDK 트랜잭션으로 검증한다(데모 에뮬레이터, 자기 경로만 쓰고 지운다).
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000') throw new Error('demo 에뮬레이터 안에서만 검증합니다.');
const dep = require('node:module').createRequire(path.resolve(__dirname, '../../functions/package.json'));
const { initializeApp, deleteApp } = dep('firebase-admin/app');
const { getDatabase } = dep('firebase-admin/database');
const { createQuizTallyFallback, INSTRUCTOR_STALE_MS } = require('../../functions/quiz-tally');

const app = initializeApp({ projectId: 'demo-dorandoran', databaseURL: 'https://demo-dorandoran.firebaseio.com' }, `quiz-tally-${process.pid}`);
const db = getDatabase(app);
const sid = `qa_quiz_tally_${process.pid}`;
const handle = createQuizTallyFallback({ db, logger: {} });
after(async () => { await db.ref(`sessions/${sid}`).remove(); await deleteApp(app); });

async function seed(aggregate) {
  await db.ref(`sessions/${sid}`).set({
    creatorId: 'legacy_teacher', currentQuestion: 'q1', currentMode: 'quiz',
    questions: { q1: { title: '2+2', type: 'quiz', options: ['3', '4', '5'], correctAnswer: '4', activatedAt: 4242 } },
    ...(aggregate ? { publicQuizAggregates: { q1: aggregate } } : {}),
  });
}
const vote = (pid, value) => db.ref(`sessions/${sid}/questions/q1/votes/${pid}`).set({ value, nickname: pid, timestamp: Date.now() });
const aggregate = async () => (await db.ref(`sessions/${sid}/publicQuizAggregates/q1`).get()).val();

test('강사 신호가 살아 있으면 서버는 집계를 건드리지 않는다', async () => {
  const live = { round: 4242, total: 0, counts: [0, 0, 0], heartbeat: Date.now() };
  await seed(live);
  for (let i = 0; i < 50; i++) await vote(`s${i}`, '4');
  assert.equal(await handle({ sid, qId: 'q1' }), 'instructor-fresh');
  assert.deepEqual(await aggregate(), live);
});

test('강사 신호가 끊기면 동시에 들어온 투표를 빠짐없이 다시 센다', async () => {
  const stale = Date.now() - INSTRUCTOR_STALE_MS - 5000;
  await seed({ round: 4242, total: 0, counts: [0, 0, 0], heartbeat: stale });
  // 투표 90개를 세 번에 나눠 쓰고, 투표마다 트리거가 불린 것처럼 동시에 처리한다.
  const values = ['3', '4', '5'];
  for (let wave = 0; wave < 3; wave++) {
    const batch = Array.from({ length: 30 }, (_, i) => `w${wave}_${i}`);
    await Promise.all(batch.map((pid, i) => vote(pid, values[(i + wave) % 3])));
    await Promise.all(batch.map(() => handle({ sid, qId: 'q1' })));
  }
  const final = await aggregate();
  assert.equal(final.source, 'server');
  assert.equal(final.round, 4242);
  assert.equal(final.total, 90);
  assert.deepEqual(final.counts, [30, 30, 30]);
  assert.equal(final.heartbeat, stale, '서버는 강사 신호를 새로 찍지 않는다');
  assert.ok(!('nickname' in final) && !('votes' in final), '개인 응답은 공개 집계에 들어가지 않는다');
});

test('강사 화면이 돌아와 덮어쓰면 다시 강사 집계가 주인이 된다', async () => {
  await db.ref(`sessions/${sid}/publicQuizAggregates/q1`).set({ round: 4242, total: 90, counts: [30, 30, 30], heartbeat: Date.now() });
  await vote('late', '3');
  assert.equal(await handle({ sid, qId: 'q1' }), 'instructor-fresh');
  assert.equal((await aggregate()).source, undefined);
});

test('퀴즈가 아니거나 전자칠판이 집계를 보지 않는 화면이면 손대지 않는다', async () => {
  await seed();
  await db.ref(`sessions/${sid}/currentMode`).set('leaderboard');
  await vote('x', '4');
  assert.equal(await handle({ sid, qId: 'q1' }), 'not-shown');
  assert.equal(await aggregate(), null);
  await db.ref(`sessions/${sid}/questions/q1/type`).set('choice');
  assert.equal(await handle({ sid, qId: 'q1' }), 'not-quiz');
});
