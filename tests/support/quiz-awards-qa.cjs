const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { chromium } = require('@playwright/test');
const root = path.resolve(__dirname, '../..');
const deps = createRequire(path.join(root, 'functions/package.json'));
process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const { initializeApp, deleteApp } = deps('firebase-admin/app');
const { getDatabase } = deps('firebase-admin/database');
const { getAuth } = deps('firebase-admin/auth');
const namespace = 'demo-dorandoran-awards-audit';
const sid = 'qa_quiz_awards';
const app = initializeApp({ projectId: namespace, databaseURL: `https://${namespace}.firebaseio.com` }, 'quiz-awards-audit');
const database = getDatabase(app);
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5175';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error('QA requires a loopback browser origin');
const artifacts = process.env.QA_ARTIFACT_DIR || '/tmp/dorandoran-quiz-awards-audit';
fs.mkdirSync(artifacts, { recursive: true });
const rules = JSON.parse(fs.readFileSync(path.join(root, 'database.rules.json'), 'utf8'));
async function applyRules(value) {
  const response = await fetch(`http://127.0.0.1:9000/.settings/rules.json?ns=${namespace}`, { method: 'PUT', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  if (!response.ok) throw new Error(`isolated emulator rules failed: ${response.status}`);
}
const q = (overrides = {}) => ({ type: 'quiz', title: '점수 원자성 검증', correctAnswer: 'A', options: ['A', 'B'], order: 1, activatedAt: 1000,
  event: { id: 'double-points', pointMultiplier: 2 }, betting: true,
  votes: { learner_a: { value: 'A', nickname: '긴이름학생', bet: '2', timestamp: 1000 }, learner_b: { value: 'B', nickname: '학생둘', bet: '3', timestamp: 1000 } }, ...overrides });
const read = async suffix => (await database.ref(`sessions/${sid}/${suffix}`).get()).val();
let browser;
(async () => {
  await applyRules(rules);
  await database.ref().set({ admins: { teacher_a: { role: 'master', approved: true }, teacher_b: { role: 'master', approved: true } },
    sessions: { [sid]: { creatorId: 'teacher_a', courseId: 'qa_course', courseName: '점수 검증', status: 'active', currentMode: 'quiz', currentQuestion: 'q1', createdAt: 1,
      participants: { learner_a: { nickname: '예전에길게저장되었던학습자이름', joinedAt: 1 }, learner_b: { nickname: '학생둘', joinedAt: 1 } },
      questions: { q1: q() }, scores: { learner_a: { nickname: '기존별명', total: 10, streak: 2, bestStreak: 5 } } } } });
  browser = await chromium.launch(process.platform === 'darwin' ? { channel: 'chrome' } : {});
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  const pageErrors = [];
  for (let index = 0; index < pages.length; index++) {
    const page = pages[index], uid = index === 0 ? 'teacher_a' : 'teacher_b';
    page.on('pageerror', error => pageErrors.push(error.message));
    const token = await getAuth(app).createCustomToken(uid, { role: 'master', approved: true });
    await page.goto(base + '/manifest.json');
    await page.evaluate(async ({ namespace, token, uid }) => {
      const sdkApp = await import('/node_modules/.vite/deps/firebase_app.js');
      const sdkAuth = await import('/node_modules/.vite/deps/firebase_auth.js');
      const sdkDb = await import('/node_modules/.vite/deps/firebase_database.js');
      const app = sdkApp.initializeApp({ projectId: namespace, apiKey: 'demo-awards-audit', databaseURL: `https://${namespace}.firebaseio.com`, appId: 'demo-awards-audit' }, uid);
      const auth = sdkAuth.getAuth(app); sdkAuth.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      await sdkAuth.signInWithCustomToken(auth, token);
      const db = sdkDb.getDatabase(app); sdkDb.connectDatabaseEmulator(db, '127.0.0.1', 9000);
      window.awardDb = db; window.awardSdk = sdkDb;
      window.awardLib = await import('/src/lib/quiz-awards.js');
    }, { namespace, token, uid });
  }
  const award = (page, questionId = 'q1', now = Date.now()) => page.evaluate(async ({ sid, questionId, now }) => window.awardLib.awardQuizRound(window.awardDb, sid, questionId, now), { sid, questionId, now });
  // Independent teacher runtimes race against the actual Firebase score transaction.
  const result = await Promise.all([award(pages[0]), award(pages[1])]);
  let scores = await read('scores');
  if (scores.learner_a.total !== 610 || scores.learner_a.streak !== 3 || scores.learner_b.total !== -60) throw new Error('Concurrent reveals duplicated/lost rewards');
  if (scores.learner_a.nickname.length > 10) throw new Error('Legacy nickname was not score-normalized');
  if ((await read('participants/learner_a/nickname')) !== '예전에길게저장되었던학습자이름') throw new Error('Original participant nickname mutated');
  console.log('PASS two independent teachers: one award per round; original long nickname preserved');
  // A denied score transaction leaves revealedAt retryable, without awardedAt or partial points.
  await database.ref(`sessions/${sid}/questions/q2`).set(q({ order: 2 }));
  const denyScores = structuredClone(rules); denyScores.rules.sessions.$sid.scores['.write'] = false; denyScores.rules.sessions.$sid.scores['.validate'] = false;
  await applyRules(denyScores);
  const before = JSON.stringify(await read('scores'));
  const failure = await award(pages[0], 'q2').then(() => null, error => error.message);
  if (!failure || (await read('questions/q2')).awardedAt != null || JSON.stringify(await read('scores')) !== before) throw new Error('Denied transaction left a payout marker or partial reward: '+JSON.stringify({failure,marker:(await read('questions/q2')).awardedAt,changed:JSON.stringify(await read('scores'))!==before}));
  await applyRules(rules);
  await award(pages[1], 'q2'); await award(pages[0], 'q2');
  scores = await read('scores');
  if (scores.learner_a.total !== 1210 || scores.learner_a.streak !== 4 || scores.learner_b.total !== -120) throw new Error('Denied retry duplicated/lost points');
  console.log('PASS actual score-write denial -> retry: complete once, no partial scoring');
  // Close/crash after score commit, before awardedAt: retry sees receipts and only marks completion.
  await database.ref(`sessions/${sid}/questions/q3`).set(q({ order: 3 }));
  const denyMarker = structuredClone(rules); denyMarker.rules.sessions.$sid.questions.$qId.awardedAt['.validate'] = false;
  await applyRules(denyMarker);
  const markerFailure = await award(pages[0], 'q3').then(() => null, error => error.message);
  if (!markerFailure || (await read('questions/q3')).awardedAt != null) throw new Error('Marker-denied scenario did not fail');
  const committed = JSON.stringify(await read('scores'));
  await applyRules(rules); await award(pages[1], 'q3');
  if (JSON.stringify(await read('scores')) !== committed || !(await read('questions/q3')).awardedAt) throw new Error('Marker retry re-applied points');
  console.log('PASS score committed / completion marker denied -> retry: no duplicate award');
  // Legacy marks are authoritative preservation boundaries, even if receipts do not exist.
  await database.ref(`sessions/${sid}/questions/legacy`).set(q({ awardedAt: 77, revealedAt: 77 }));
  const legacyBefore = JSON.stringify(await read('scores')); await award(pages[0], 'legacy');
  if (JSON.stringify(await read('scores')) !== legacyBefore || (await read('questions/legacy/awardedAt')) !== 77) throw new Error('Legacy marker was changed/re-awarded');
  console.log('PASS existing legacy awardedAt: no writes or re-award');
  // Round fencing rejects a late score transaction after another teacher resets the question.
  await database.ref(`sessions/${sid}/questions/fence`).set(q({ revealedAt: 6000 }));
  const oldQuestion = await read('questions/fence');
  await database.ref(`sessions/${sid}/questions/fence/revealedAt`).remove();
  const fenced = await pages[0].evaluate(async ({ sid, question }) => {
    try { await window.awardSdk.runTransaction(window.awardSdk.ref(window.awardDb, `sessions/${sid}/scores`), current => window.awardLib.applyQuizScoreAwards(current, question, 'fence', 6000), { applyLocally: false }); return false; }
    catch { return true; }
  }, { sid, question: oldQuestion });
  if (!fenced) throw new Error('Reset changed epoch but stale score write still succeeded');
  console.log('PASS actual rules fence: reset epoch rejects stale score transaction');
  // New activation/reveal of the same question is a new payable round, old receipts stay bounded.
  await database.ref(`sessions/${sid}/questions/q1`).set(q({ activatedAt: 7000, votes: { learner_a: { value: 'A', timestamp: 7000, bet: '2', nickname: '다시학생' } } }));
  const beforeNew = (await read('scores/learner_a')).total; await award(pages[0], 'q1', 8000);
  if ((await read('scores/learner_a')).total !== beforeNew + 600) throw new Error('New round was not paid');
  console.log('PASS reactivate same question: distinct reveal epoch pays once');
  // Durable speed round preserves combo when speedQuiz.active is already stopped before retry.
  await database.ref(`sessions/${sid}/questions/speed`).set(q({ activatedAt: 9000, speedQuizRound: 9000, votes: { learner_a: { value: 'A', timestamp: 9000, bet: '2', nickname: '스피드학생' } } }));
  await database.ref(`sessions/${sid}/speedQuiz`).remove();
  const beforeSpeed = (await read('scores/learner_a')).total; await award(pages[1], 'speed', 10000);
  if ((await read('scores/learner_a')).total !== beforeSpeed + 900) throw new Error('Speed round retry lost combo policy');
  console.log('PASS durable speed-round combo after active flag is cleared');
  const locks = await Promise.all(pages.map(page => page.evaluate(() => window.awardLib.quizAwardLocks.size)));
  if (locks.some(Boolean) || pageErrors.length) throw new Error('Lock leaked or browser error: ' + JSON.stringify({ locks, pageErrors }));
  fs.writeFileSync(path.join(artifacts, 'receipt-results.json'), JSON.stringify({ concurrentResults: result, scores: await read('scores'), locks, pageErrors }, null, 2));
  await Promise.all(contexts.map(context => context.close())); await browser.close(); await deleteApp(app);
  console.log('ALL PASS atomic/idempotent quiz award pipeline, pageerror0, lock0');
})().catch(async error => { console.error(error); await browser?.close().catch(() => {}); await deleteApp(app); process.exitCode = 1; });
