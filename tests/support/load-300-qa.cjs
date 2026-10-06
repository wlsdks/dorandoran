// 대규모 수업 부하 측정 (수동 실행 도구). 로컬 demo 에뮬레이터 전용, 자기 세션만 만든다.
// 사용: QA_BASE_URL=http://127.0.0.1:5175 QA_STUDENTS=300 node tests/support/load-300-qa.cjs
// 학생은 firebase 클라이언트 SDK + 익명 로그인으로 쓰므로 보안 규칙이 그대로 적용된다.
const path = require('node:path');
const fs = require('node:fs');
process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000';
const deps = require('node:module').createRequire(path.resolve(__dirname, '../../functions/package.json'));
const admin = deps('firebase-admin/app');
const adminDb = deps('firebase-admin/database');
const { initializeApp, deleteApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, signInAnonymously } = require('firebase/auth');
const { getDatabase, connectDatabaseEmulator, ref, set, update, push, serverTimestamp } = require('firebase/database');
const { chromium } = require('@playwright/test');

const BASE = process.env.QA_BASE_URL || 'http://127.0.0.1:5175';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw new Error('Loopback QA origin required');
const N = Number(process.env.QA_STUDENTS || 150);
const LABEL = process.env.QA_LABEL || 'run';
const OUT = process.env.QA_ARTIFACT_DIR || path.join(require('node:os').tmpdir(), 'dorandoran-load');
fs.mkdirSync(OUT, { recursive: true });
const sid = `qa_k_${LABEL}_${N}_${Date.now().toString(36)}`;
const app = admin.initializeApp({ projectId: 'demo-dorandoran', databaseURL: 'https://demo-dorandoran.firebaseio.com' }, `admin-${sid}`);
const db = adminDb.getDatabase(app);
const pause = ms => new Promise(r => setTimeout(r, ms));
const pct = (arr, p) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]); };

async function pool(items, size, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: size }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}

async function student(index) {
  const a = initializeApp({ apiKey: 'demo-key', projectId: 'demo-dorandoran', databaseURL: 'https://demo-dorandoran.firebaseio.com' }, `s-${sid}-${index}`);
  const auth = getAuth(a); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const d = getDatabase(a); connectDatabaseEmulator(d, '127.0.0.1', 9000);
  const { user } = await signInAnonymously(auth);
  const nickname = `학생${String(index + 1).padStart(3, '0')}`;
  await set(ref(d, `sessions/${sid}/nicknames/${nickname}`), user.uid);
  await update(ref(d, `sessions/${sid}`), {
    [`participants/${user.uid}/nickname`]: nickname,
    [`participants/${user.uid}/joinedAt`]: serverTimestamp(),
    [`participants/${user.uid}/connections/c0`]: true,
  });
  return { app: a, db: d, uid: user.uid, nickname };
}

async function cpuSampler(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const read = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  const start = await read(); const t0 = Date.now();
  return async () => { const end = await read(); const wall = (Date.now() - t0) / 1000;
    return { cpu: Math.round((end.TaskDuration - start.TaskDuration) / wall * 100), scriptPct: Math.round((end.ScriptDuration - start.ScriptDuration) / wall * 100), heapMB: Math.round(end.JSHeapUsedSize / 1048576) }; };
}

async function instrument(page) {
  await page.addInitScript(() => {
    globalThis.__long = [];
    try { new PerformanceObserver(list => list.getEntries().forEach(e => globalThis.__long.push(e.duration))).observe({ type: 'longtask', buffered: true }); } catch { /* 지원 안 함 */ }
    globalThis.__timeline = [];
    const sample = () => { const m = /응답\s*([\d,]+)\s*명/.exec(document.body?.innerText || ''); if (m) { const v = Number(m[1].replace(/,/g, '')); const last = globalThis.__timeline.at(-1); if (!last || last[1] !== v) globalThis.__timeline.push([Date.now(), v]); } requestAnimationFrame(sample); };
    requestAnimationFrame(sample);
  });
}

async function wave(students, questionId, valueOf, board) {
  await board.evaluate(() => { globalThis.__timeline = []; globalThis.__long = []; });
  const acks = []; const errors = {};
  const groups = [students.slice(0, Math.ceil(N / 3)), students.slice(Math.ceil(N / 3), Math.ceil(2 * N / 3)), students.slice(Math.ceil(2 * N / 3))];
  for (const group of groups) {
    await Promise.all(group.map(async (s, i) => {
      await pause(Math.random() * 3000);
      try { await set(ref(s.db, `sessions/${sid}/questions/${questionId}/votes/${s.uid}`), { value: valueOf(i), nickname: s.nickname, timestamp: serverTimestamp() }); acks.push(Date.now()); }
      catch (e) { errors[e.code || e.message] = (errors[e.code || e.message] || 0) + 1; }
    }));
    await pause(1000);
  }
  await pause(3000);
  const timeline = await board.evaluate(() => globalThis.__timeline);
  const longs = await board.evaluate(() => globalThis.__long);
  acks.sort((a, b) => a - b);
  const lat = acks.map((t, i) => { const hit = timeline.find(([, v]) => v >= i + 1); return hit ? Math.max(0, hit[0] - t) : null; }).filter(v => v !== null);
  return { written: acks.length, shownOnBoard: timeline.at(-1)?.[1] ?? 0, p50: pct(lat, 0.5), p95: pct(lat, 0.95), errors, boardLongTasks: longs.length, boardLongMs: Math.round(longs.reduce((a, b) => a + b, 0)) };
}

(async () => {
  const now = Date.now();
  await db.ref(`sessions/${sid}`).set({ creatorId: 'kim_teacher', courseId: 'course_demo', courseName: `부하 ${N}명`, createdAt: now, startedAt: now, status: 'active', currentMode: 'poll', currentQuestion: 'q_choice',
    questions: {
      q_choice: { order: 0, type: 'choice', title: '오늘 컨디션은?', options: ['좋아요', '보통', '피곤해요', '최고'], activatedAt: now },
      q_quiz: { order: 1, type: 'quiz', title: '2+2는?', options: ['3', '4', '5', '22'], correctAnswer: '4', points: 100, speedWindowMs: 30000, maxSpeedBonus: 50 },
    } });
  const browser = await chromium.launch();
  const tctx = await browser.newContext({ viewport: { width: 1512, height: 945 } }); const teacher = await tctx.newPage();
  await instrument(teacher);
  await teacher.goto(`${BASE}/admin?s=${sid}`);
  await teacher.getByPlaceholder('아이디').fill('kim-teacher'); await teacher.getByPlaceholder('비밀번호').fill('TestFixture-Only-Strong8');
  await teacher.getByRole('button', { name: '로그인', exact: true }).click(); await pause(4000);
  const bctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } }); const board = await bctx.newPage();
  await instrument(board); await board.goto(`${BASE}/live?s=${sid}`); await pause(3000);
  const boardCpu = await cpuSampler(board); const teacherCpu = await cpuSampler(teacher);

  const t0 = Date.now();
  const students = await pool(Array.from({ length: N }, (_, i) => i), 25, i => student(i));
  const joinMs = Date.now() - t0;
  await pause(2000);
  const report = { label: LABEL, students: N, sessionId: sid, joinMs };
  report.choice = await wave(students, 'q_choice', i => ['좋아요', '보통', '피곤해요', '최고'][i % 4], board);
  await db.ref(`sessions/${sid}`).update({ currentQuestion: 'q_quiz', 'questions/q_quiz/activatedAt': Date.now() });
  await pause(3000);
  report.quiz = await wave(students, 'q_quiz', i => ['3', '4', '5', '22'][i % 4], board);
  // 반응 폭주: 학생 전원이 2번씩
  const rStart = Date.now(); let rErr = 0;
  await Promise.all(students.flatMap(s => [0, 1].map(async k => { await pause(Math.random() * 5000 + k * 3000); try { await push(ref(s.db, `sessions/${sid}/reactions`), { type: 'like', timestamp: serverTimestamp() }); } catch { rErr++; } })));
  report.reactions = { sent: N * 2, errors: rErr, ms: Date.now() - rStart, stored: Object.keys((await db.ref(`sessions/${sid}/reactions`).get()).val() || {}).length };
  report.boardCpu = await boardCpu(); report.teacherCpu = await teacherCpu();
  report.teacherLongTasks = await teacher.evaluate(() => ({ count: globalThis.__long.length, ms: Math.round(globalThis.__long.reduce((a, b) => a + b, 0)) }));
  await board.screenshot({ path: path.join(OUT, `${LABEL}-${N}-board.png`) });
  fs.writeFileSync(path.join(OUT, `${LABEL}-${N}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  await browser.close();
  await Promise.all(students.map(s => deleteApp(s.app).catch(() => {})));
  await admin.deleteApp(app); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
