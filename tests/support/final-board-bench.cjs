// 전자칠판 단독 벤치(수동 실행 도구): /live 1 + 강사 1 + 4배 스로틀 폰 1 + SDK 학생 200, 녹화 없음, 단계별 CPU 프로파일.
// 로컬 demo 에뮬레이터 전용. 결과는 QA_OUT(기본 os.tmpdir()/dorandoran-final/bench)/<label>.json
// QA_BASE_URL=http://127.0.0.1:5175 QA_LABEL=run node tests/support/final-board-bench.cjs
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const ROOT = path.resolve(__dirname, '../..');
const req = require('node:module').createRequire(path.join(ROOT, 'package.json'));
const deps = require('node:module').createRequire(path.join(ROOT, 'functions/package.json'));
const admin = deps('firebase-admin/app'); const adminDb = deps('firebase-admin/database');
const { initializeApp, deleteApp } = req('firebase/app');
const { getAuth, connectAuthEmulator, signInAnonymously } = req('firebase/auth');
const { getDatabase, connectDatabaseEmulator, ref, set, update, push, serverTimestamp, forceWebSockets } = req('firebase/database');
const { chromium } = req('@playwright/test');
const instrument = require('./perf-instrument.cjs');
const BASE = process.env.QA_BASE_URL || 'http://127.0.0.1:5175';
const N = Number(process.env.QA_STUDENTS || 200);
const LABEL = process.env.QA_LABEL || 'bench';
const OUT = process.env.QA_OUT || path.join(require('node:os').tmpdir(), 'dorandoran-final', 'bench'); fs.mkdirSync(OUT, { recursive: true });
const IMG_PORT = 5181;
const sid = `qa_bench_${LABEL}_${Date.now().toString(36)}`;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)(7);
forceWebSockets();
const app = admin.initializeApp({ projectId: 'demo-dorandoran', databaseURL: 'https://demo-dorandoran.firebaseio.com' }, `bench-${sid}`);
const db = adminDb.getDatabase(app);
const OPTIONS = ['한라산', '설악산', '지리산', '북한산'];
const WORDS = ['집중', '배움', '친구', '열정', '호기심', '성장', '도전', '협력', '발견', '즐거움', '몰입', '질문', '생각', '꿈', '용기', '창의', '설렘', '의지', '시작', '여유', '웃음', '평온', '기대', '감사', '응원'];
const QUESTIONS = {
  q_photo: { order: 0, type: 'quiz', title: '사진 속 산은 어디일까요?', options: OPTIONS, optionImages: ['a', 'b', 'c', 'd'].map((n) => `http://127.0.0.1:${IMG_PORT}/${n}.png`), correctAnswer: '설악산', points: 100, speedWindowMs: 20000, maxSpeedBonus: 50 },
  q_choice: { order: 1, type: 'choice', title: '오늘 컨디션은 어떤가요?', options: ['좋아요', '보통이에요', '피곤해요', '최고예요'] },
  q_word: { order: 2, type: 'wordcloud', title: '오늘 수업을 한 단어로 표현하면?' },
};
const report = { label: LABEL, sessionId: sid, phases: {}, profiles: {} };
function startImageServer() {
  const dir = path.join(ROOT, 'tests', 'fixtures', 'slides');
  const server = http.createServer((rq, rs) => { const file = path.join(dir, path.basename(rq.url.split('?')[0])); if (!fs.existsSync(file)) { rs.writeHead(404); return rs.end(); } rs.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Access-Control-Allow-Origin': '*' }); fs.createReadStream(file).pipe(rs); });
  return new Promise((r) => server.listen(IMG_PORT, '127.0.0.1', () => r(server)));
}
const sims = [];
async function makeSim(i) {
  const a = initializeApp({ apiKey: 'demo-key', projectId: 'demo-dorandoran', databaseURL: 'https://demo-dorandoran.firebaseio.com' }, `b-${sid}-${i}`);
  const auth = getAuth(a); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const d = getDatabase(a); connectDatabaseEmulator(d, '127.0.0.1', 9000);
  const { user } = await signInAnonymously(auth);
  const nickname = `학생${String(i + 1).padStart(3, '0')}`;
  await set(ref(d, `sessions/${sid}/nicknames/${nickname}`), user.uid);
  await update(ref(d, `sessions/${sid}`), { [`participants/${user.uid}/nickname`]: nickname, [`participants/${user.uid}/joinedAt`]: serverTimestamp(), [`participants/${user.uid}/connections/c0`]: true });
  return { db: d, app: a, uid: user.uid, nickname };
}
async function pool(items, size, fn) { const out = []; let i = 0; await Promise.all(Array.from({ length: size }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } })); return out; }
let browser; const pages = {};
async function newPage(name, viewport, { mobile = false, throttle = 0 } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile }); const page = await ctx.newPage();
  await page.addInitScript(instrument, { sampleCounts: name === 'board' });
  const cdp = await ctx.newCDPSession(page); await cdp.send('Performance.enable'); await cdp.send('Profiler.enable');
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  pages[name] = { page, cdp, ctx }; return pages[name];
}
async function phase(name, fn, { profile = 'board' } = {}) {
  console.log('== phase', name);
  await Promise.all(Object.values(pages).map((e) => e.page.evaluate((n) => globalThis.__perf.setPhase(n), name)));
  const prof = profile ? pages[profile] : null;
  if (prof) { await prof.cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await prof.cdp.send('Profiler.start'); }
  const t0 = Date.now();
  await fn();
  if (prof) {
    const { profile: p } = await prof.cdp.send('Profiler.stop');
    const self = new Map(); const dt = p.timeDeltas; const byId = new Map(p.nodes.map((n) => [n.id, n]));
    p.samples.forEach((id, i) => { const n = byId.get(id); const f = n.callFrame; const key = `${f.functionName || '(anon)'} ${(f.url || '').split('/').pop().split('?')[0]}:${f.lineNumber}`; self.set(key, (self.get(key) || 0) + (dt[i] || 0)); });
    const total = [...self.values()].reduce((a, b) => a + b, 0);
    const top = [...self.entries()].filter(([k]) => !/^\(idle\)|^\(program\)|^\(garbage/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${(v / 1000).toFixed(0)}ms ${k}`);
    const idle = self.get('(idle) :0') || 0;
    report.profiles[name] = { wallMs: Date.now() - t0, busyPct: Math.round((total - idle) / total * 100), top };
  }
  await Promise.all(Object.values(pages).map((e) => e.page.evaluate((n) => globalThis.__perf.setPhase(n + ':gap'), name)));
}
(async () => {
  const img = await startImageServer();
  const now = Date.now();
  await db.ref(`sessions/${sid}`).set({ creatorId: 'kim_teacher', courseId: 'course_demo', courseName: `보드 벤치 ${N}`, createdAt: now, startedAt: now, status: 'active', currentMode: 'waiting', currentQuestion: null, questions: QUESTIONS });
  browser = await chromium.launch({ headless: true });
  const adminP = await newPage('admin', { width: 1512, height: 945 });
  await adminP.page.goto(`${BASE}/admin`); await adminP.page.getByPlaceholder('아이디').fill('kim-teacher'); await adminP.page.getByPlaceholder('비밀번호').fill('TestFixture-Only-Strong8');
  await adminP.page.getByRole('button', { name: '로그인', exact: true }).click(); await adminP.page.getByRole('button', { name: '내 클래스', exact: true }).waitFor({ timeout: 20000 });
  await adminP.page.goto(`${BASE}/admin?s=${sid}`); await adminP.page.getByRole('button', { name: '질문 활성화', exact: true }).first().waitFor({ timeout: 30000 });
  const board = await newPage('board', { width: 1920, height: 1080 });
  await board.page.goto(`${BASE}/live?s=${sid}`); await board.page.getByText(/접속 중|기다리는 중/).first().waitFor({ timeout: 30000 });
  const activate = async (title, qid) => {
    const card = adminP.page.getByLabel(`문항 관리: ${title}`, { exact: true }).first().locator('xpath=ancestor::div[.//button[@aria-label="질문 활성화"]][1]');
    await card.getByRole('button', { name: '질문 활성화', exact: true }).first().click();
    for (let i = 0; i < 100; i++) { if ((await db.ref(`sessions/${sid}/currentQuestion`).get()).val() === qid) return; await pause(50); }
    throw new Error('activate failed ' + qid);
  };
  const reveal = () => adminP.page.getByRole('button', { name: '정답 공개', exact: true }).first().click();
  // One real phone, CPU x4, no video: clean input→paint numbers for the student side.
  const phone = await newPage('phone', { width: 390, height: 844 }, { mobile: true, throttle: 4 });
  await phone.page.goto(`${BASE}/?s=${sid}`); await phone.page.getByPlaceholder('닉네임 입력').fill('벤치폰'); await phone.page.getByRole('button', { name: '참여하기', exact: true }).click();
  await phone.page.getByText(/준비됐어요|기다리는 중|곧 다음/).first().waitFor({ timeout: 20000 });
  const tap = async (label, fn) => { try { await fn(phone.page); } catch (e) { console.log('phone action failed', label, e.message.split('\n')[0]); } };

  await phase('join', async () => { await pool(Array.from({ length: N }, (_, i) => i), 30, async (i) => { sims[i] = await makeSim(i); }); await pause(3000); });
  await phase('quizVotesOnly', async () => { await activate(QUESTIONS.q_photo.title, 'q_photo'); await pause(1000); await tap('quiz', (p) => p.getByRole('button', { name: /^B\. / }).click({ timeout: 10000 })); await Promise.all(sims.map(async (s, i) => { await pause(rand() * 15000); await set(ref(s.db, `sessions/${sid}/questions/q_photo/votes/${s.uid}`), { value: OPTIONS[i % 3], nickname: s.nickname, timestamp: serverTimestamp() }).catch(() => {}); })); await pause(2000); });
  await phase('reactionsOnly', async () => { tap('reactions', async (p) => { await pause(3000); await p.getByRole('button', { name: '반응 보내기' }).click({ timeout: 10000 }); const b = p.getByRole('dialog', { name: '반응 보내기' }).getByRole('button', { name: '좋아요' }); for (let k = 0; k < 3; k++) await b.click(); await pause(1000); await b.click(); await pause(1000); await b.click(); await pause(500); await p.getByRole('button', { name: '반응 닫기' }).click(); }); await Promise.all(sims.map(async (s, i) => { await pause(rand() * 12000); const type = ['thumbsup', 'fire', 'heart', 'laugh', 'clap'][i % 5]; for (let k = 0; k < 3; k++) await push(ref(s.db, `sessions/${sid}/reactions`), { type, timestamp: serverTimestamp() }).catch(() => {}); for (let k = 0; k < 2; k++) { await pause(1000); await push(ref(s.db, `sessions/${sid}/reactions`), { type, timestamp: serverTimestamp() }).catch(() => {}); } })); await pause(4000); });
  await phase('idleAfterReactions', async () => { await pause(5000); });
  await phase('reveal', async () => { await reveal(); await pause(6000); });
  await phase('choiceVotes', async () => { await activate(QUESTIONS.q_choice.title, 'q_choice'); await pause(1000); tap('choice', async (p) => { await pause(2000); await p.getByRole('group', { name: '선택지' }).getByRole('button', { name: '좋아요' }).first().click({ timeout: 10000 }); }); await Promise.all(sims.map(async (s, i) => { await pause(rand() * 10000); await set(ref(s.db, `sessions/${sid}/questions/q_choice/votes/${s.uid}`), { value: QUESTIONS.q_choice.options[i % 4], nickname: s.nickname, timestamp: serverTimestamp() }).catch(() => {}); })); await pause(2000); });
  await phase('wordcloud', async () => { await activate(QUESTIONS.q_word.title, 'q_word'); await pause(1000); tap('word', async (p) => { await pause(2000); await p.getByLabel('단어 입력').fill('집중', { timeout: 10000 }); await p.getByRole('button', { name: '제출하기' }).click(); }); await Promise.all(sims.map(async (s, i) => { await pause(rand() * 10000); await set(ref(s.db, `sessions/${sid}/questions/q_word/votes/${s.uid}`), { value: WORDS[(i * 7) % WORDS.length], nickname: s.nickname, timestamp: serverTimestamp() }).catch(() => {}); })); await pause(2000); });
  await phase('leaderboard', async () => {
    await adminP.page.getByRole('button', { name: '수업 도구' }).first().click().catch(() => {});
    await adminP.page.getByRole('button', { name: '모드', exact: true }).first().click().catch(() => {});
    const item = adminP.page.getByRole('region', { name: '수업 화면 선택' }).getByRole('button', { name: '랭킹', exact: true }).first();
    if (await item.count()) await item.click(); else await db.ref(`sessions/${sid}`).update({ currentMode: 'leaderboard', currentQuestion: null, leaderboardPage: 0 });
    await pause(2000);
    await db.ref(`sessions/${sid}`).update({ leaderboardHighlight: { ranks: [1, 2, 3, 27], enabled: false, revealed: 0 } });
    tap('rankingSheet', async (p) => { await pause(4000); await p.getByRole('button', { name: /랭킹/ }).first().click({ timeout: 10000 }); await pause(2000); await p.keyboard.press('Escape'); });
    for (const [i, rank] of [1, 2, 3, 27].entries()) { await db.ref(`sessions/${sid}`).update({ leaderboardHighlight: { ranks: [1, 2, 3, 27], enabled: true, revealed: i + 1, activeRank: rank }, leaderboardPage: Math.floor((rank - 1) / 8) }); await pause(3500); }
  });
  for (const [name, e] of Object.entries(pages)) report.phases[name] = await e.page.evaluate(() => globalThis.__perf.summary());
  const m = Object.fromEntries((await board.cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
  report.boardMem = { heapMB: Math.round(m.JSHeapUsedSize / 1048576), nodes: m.Nodes, layouts: m.LayoutCount, recalcs: m.RecalcStyleCount };
  fs.writeFileSync(path.join(OUT, `${LABEL}.json`), JSON.stringify(report, null, 2));
  const cols = ['seconds', 'fps', 'frameP95', 'frameMax', 'over50', 'over100', 'loaf', 'loafMax', 'cls', 'interactions', 'inpP50', 'inpP95', 'inpMax', 'inputDelayMax'];
  for (const p of ['board', 'admin', 'phone']) { console.log('== ' + p); console.log('phase'.padEnd(20) + cols.join('\t')); for (const [n, s] of Object.entries(report.phases[p])) if (!n.endsWith(':gap') && n !== 'init') console.log(n.padEnd(20) + cols.map((c) => s[c]).join('\t')); }
  for (const [n, p] of Object.entries(report.profiles)) console.log(`-- profile ${n} busy ${p.busyPct}%\n   ${p.top.join('\n   ')}`);
  await browser.close(); img.close();
  await Promise.allSettled(sims.map((s) => deleteApp(s.app)));
  await db.ref(`sessions/${sid}`).remove(); await admin.deleteApp(app); process.exit(0);
})().catch(async (e) => { console.error(e); try { await browser?.close(); } catch { /* ignore */ } process.exit(1); });
