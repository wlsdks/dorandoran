// 200명 수업 최종 검증(수동 실행 도구): 실제 브라우저 학생 + SDK 시뮬 학생, 전자칠판/발표/폰 녹화, 단계별 성능과 정합성.
// 로컬 demo 에뮬레이터 전용, 자기 세션만 만든다. 결과는 QA_OUT(기본 os.tmpdir()/dorandoran-final/<label>)에 report.json + videos/.
// QA_BASE_URL=http://127.0.0.1:5175 QA_STUDENTS=200 QA_REAL=16 QA_LABEL=run QA_PACE=2.5 node tests/support/final-class-200.cjs
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const ROOT = path.resolve(__dirname, '../..');
const req = require('node:module').createRequire(path.join(ROOT, 'package.json'));
const deps = require('node:module').createRequire(path.join(ROOT, 'functions/package.json'));
const admin = deps('firebase-admin/app');
const adminDb = deps('firebase-admin/database');
const adminAuth = deps('firebase-admin/auth');
const { initializeApp, deleteApp } = req('firebase/app');
const { getAuth, connectAuthEmulator, signInAnonymously } = req('firebase/auth');
const { getDatabase, connectDatabaseEmulator, ref, set, update, push, get, onValue, serverTimestamp, goOffline, goOnline, forceWebSockets } = req('firebase/database');
const { chromium } = req('@playwright/test');
const instrument = require('./perf-instrument.cjs');

const BASE = process.env.QA_BASE_URL || 'http://127.0.0.1:5175';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw new Error('Loopback QA origin required');
const N = Number(process.env.QA_STUDENTS || 200);
const REAL = Number(process.env.QA_REAL || 16);
const LABEL = process.env.QA_LABEL || 'run';
const OUT = process.env.QA_OUT || path.join(require('node:os').tmpdir(), 'dorandoran-final', LABEL);
const VIDEO_DIR = path.join(OUT, 'videos');
fs.mkdirSync(VIDEO_DIR, { recursive: true });
const IMG_PORT = 5180;
const sid = `qa_final_${LABEL}_${Date.now().toString(36)}`;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
// QA_PACE stretches the dwell between moments (teacher talking, students reading) so the class runs ~10 minutes.
const PACE = Number(process.env.QA_PACE || 1);
const dwell = (ms) => pause(ms * PACE);
const pct = (arr, p) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]); };
const rand = (seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)(42);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

forceWebSockets();
const app = admin.initializeApp({ projectId: 'demo-dorandoran', databaseURL: 'https://demo-dorandoran.firebaseio.com' }, `admin-${sid}`);
const db = adminDb.getDatabase(app);

const report = { label: LABEL, sessionId: sid, students: N, real: REAL, base: BASE, startedAt: new Date().toISOString(), phases: {}, latency: {}, errors: { console: [], page: [], sim: {}, permission: 0 }, checks: {}, marks: [], frames: [] };
const save = () => fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));

// ---------- questions ----------
const OPTIONS_PHOTO = ['한라산', '설악산', '지리산', '북한산'];
const RANK_ITEMS = ['봄', '여름', '가을', '겨울'];
const RANK_ANSWER = '0,2,3,1'; // 1→3→4→2
const CHOICE = ['좋아요', '보통이에요', '피곤해요', '최고예요'];
const WORDS = ['집중', '배움', '친구', '열정', '호기심', '성장', '도전', '협력', '발견', '즐거움', '몰입', '질문', '생각', '꿈', '용기', '창의', '설렘', '의지', '시작', '여유', '웃음', '평온', '기대', '감사', '응원'];
const QUESTIONS = {
  q_photo: { order: 0, type: 'quiz', title: '사진 속 산은 어디일까요?', options: OPTIONS_PHOTO, optionImages: ['a', 'b', 'c', 'd'].map((n) => `http://127.0.0.1:${IMG_PORT}/${n}.png`), correctAnswer: '설악산', points: 100, speedWindowMs: 20000, maxSpeedBonus: 50 },
  q_rank: { order: 1, type: 'ranking', title: '계절을 좋아하는 순서대로 맞혀보세요', options: RANK_ITEMS, correctAnswer: RANK_ANSWER },
  q_choice: { order: 2, type: 'choice', title: '오늘 컨디션은 어떤가요?', options: CHOICE },
  q_word: { order: 3, type: 'wordcloud', title: '오늘 수업을 한 단어로 표현하면?' },
  q_scale: { order: 4, type: 'scale', title: '오늘 수업 난이도는 어땠나요?', minLabel: '쉬움', maxLabel: '어려움' },
};
const QIDS = Object.keys(QUESTIONS);

// ---------- static image server (http option image URLs — the rule allows http(s) only) ----------
function startImageServer() {
  const dir = path.join(ROOT, 'tests', 'fixtures', 'slides');
  const server = http.createServer((rq, rs) => {
    const file = path.join(dir, path.basename(rq.url.split('?')[0]));
    if (!fs.existsSync(file)) { rs.writeHead(404); return rs.end(); }
    rs.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=600' });
    fs.createReadStream(file).pipe(rs);
  });
  return new Promise((r) => server.listen(IMG_PORT, '127.0.0.1', () => r(server)));
}

// ---------- simulated students ----------
const sims = [];
function simError(code) { report.errors.sim[code] = (report.errors.sim[code] || 0) + 1; if (/permission/i.test(code)) report.errors.permission += 1; }
async function makeSim(index) {
  const a = initializeApp({ apiKey: 'demo-key', projectId: 'demo-dorandoran', databaseURL: 'https://demo-dorandoran.firebaseio.com' }, `s-${sid}-${index}`);
  const auth = getAuth(a); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const d = getDatabase(a); connectDatabaseEmulator(d, '127.0.0.1', 9000);
  const { user } = await signInAnonymously(auth);
  const nickname = `학생${String(index + 1).padStart(3, '0')}`;
  const s = { app: a, db: d, uid: user.uid, nickname, index, connected: false, score: null, question: null };
  await set(ref(d, `sessions/${sid}/nicknames/${nickname}`), user.uid);
  await update(ref(d, `sessions/${sid}`), { [`participants/${user.uid}/nickname`]: nickname, [`participants/${user.uid}/joinedAt`]: serverTimestamp(), [`participants/${user.uid}/connections/c0`]: true });
  // Subscriptions a real phone would hold: public questions, my score, participants (waiting room), reactions tail
  const fail = (e) => simError(e.code || e.message);
  onValue(ref(d, '.info/connected'), (snap) => { s.connected = snap.val() === true; }, fail);
  onValue(ref(d, `sessions/${sid}/publicQuestions`), (snap) => { s.publicQuestions = snap.val(); }, fail);
  onValue(ref(d, `sessions/${sid}/currentQuestion`), (snap) => { s.question = snap.val(); }, fail);
  onValue(ref(d, `sessions/${sid}/scores/${user.uid}`), (snap) => { s.score = snap.val(); }, fail);
  onValue(ref(d, `sessions/${sid}/participants`), () => {}, fail);
  return s;
}
async function pool(items, size, fn) { const out = []; let i = 0; await Promise.all(Array.from({ length: size }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } })); return out; }
async function simVote(s, qid, value) {
  const t = Date.now();
  try { await set(ref(s.db, `sessions/${sid}/questions/${qid}/votes/${s.uid}`), { value, nickname: s.nickname, timestamp: serverTimestamp() }); return { t, ok: true, ack: Date.now() }; }
  catch (e) { simError(e.code || e.message); return { t, ok: false }; }
}
async function simReact(s, type) { try { await push(ref(s.db, `sessions/${sid}/reactions`), { type, timestamp: serverTimestamp() }); return true; } catch (e) { simError(e.code || e.message); return false; } }

// ---------- browsers ----------
let browser; const contexts = []; const pages = {}; const realStudents = [];
function wireErrors(page, name) {
  page.on('console', (m) => { if (m.type() === 'error') { const text = m.text(); if (/permission_denied|PERMISSION_DENIED/i.test(text)) report.errors.permission += 1; report.errors.console.push({ page: name, text: text.slice(0, 300), at: Date.now() }); } });
  page.on('pageerror', (e) => report.errors.page.push({ page: name, text: String(e.message).slice(0, 300), at: Date.now() }));
}
async function newPage(name, { viewport, record = false, mobile = false, throttle = 0, sampleCounts = false }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, ...(record ? { recordVideo: { dir: VIDEO_DIR, size: viewport } } : {}) });
  contexts.push({ ctx, name, record });
  const page = await ctx.newPage();
  const videoStart = Date.now();
  await page.addInitScript(instrument, { sampleCounts });
  wireErrors(page, name);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  const entry = { page, cdp, name, videoStart, throttle, mobile };
  pages[name] = entry;
  return entry;
}
async function metrics(entry) { const m = Object.fromEntries((await entry.cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value])); return { heapMB: Math.round(m.JSHeapUsedSize / 1048576), nodes: m.Nodes, listeners: m.JSEventListeners, layouts: m.LayoutCount, recalcs: m.RecalcStyleCount, taskS: Math.round(m.TaskDuration * 10) / 10 }; }
async function setPhase(name) {
  report.marks.push({ name, at: Date.now() });
  log(`=== phase ${name}`);
  await Promise.all(Object.values(pages).map((e) => e.page.evaluate((n) => globalThis.__perf?.setPhase(n), name).catch(() => {})));
}
function mark(label, pagesList = ['board']) { const at = Date.now(); report.frames.push({ label, at, pages: pagesList }); log(`-- mark ${label}`); }

async function loginTeacher(page) {
  await page.goto(`${BASE}/admin`);
  await page.getByPlaceholder('아이디').fill('kim-teacher');
  await page.getByPlaceholder('비밀번호').fill('TestFixture-Only-Strong8');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.getByRole('button', { name: '내 클래스', exact: true }).waitFor({ timeout: 20000 });
}

async function joinReal(entry, nickname) {
  const { page } = entry;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(`${BASE}/?s=${sid}`, { waitUntil: 'domcontentloaded' });
      await page.getByPlaceholder('닉네임 입력').fill(nickname, { timeout: 20000 });
      await page.getByRole('button', { name: '참여하기', exact: true }).click();
      await page.getByText(/준비됐어요|기다리는 중|곧 다음/).first().waitFor({ timeout: 20000 });
      return true;
    } catch (e) { log(`join retry ${nickname}: ${e.message.split('\n')[0]}`); await pause(1500); }
  }
  return false;
}

// Real student actions — never throw; one slow phone must not stall the class.
const safe = async (entry, label, fn) => { try { await fn(entry.page); return true; } catch (e) { report.errors.console.push({ page: entry.name, text: `[action ${label}] ${e.message.split('\n')[0].slice(0, 200)}`, at: Date.now() }); return false; } };
const tapQuizOption = (entry, optionIndex) => safe(entry, 'quiz', async (page) => { await page.getByRole('button', { name: new RegExp(`^${'ABCD'[optionIndex]}\\. `) }).click({ timeout: 15000 }); });
const tapChoice = (entry, text) => safe(entry, 'choice', async (page) => { await page.getByRole('group', { name: '선택지' }).getByRole('button', { name: text }).first().click({ timeout: 15000 }); });
const typeWord = (entry, word) => safe(entry, 'word', async (page) => { await page.getByLabel('단어 입력').fill(word, { timeout: 15000 }); await page.getByRole('button', { name: '제출하기' }).click(); });
const tapScale = (entry, v) => safe(entry, 'scale', async (page) => { await page.getByRole('button', { name: String(v), exact: true }).first().click({ timeout: 15000 }); await page.getByRole('button', { name: /제출|투표/ }).first().click(); });
const sendReactions = (entry, type) => safe(entry, 'react', async (page) => {
  await page.getByRole('button', { name: '반응 보내기' }).click({ timeout: 15000 });
  const btn = page.getByRole('dialog', { name: '반응 보내기' }).getByRole('button', { name: type });
  for (let i = 0; i < 3; i++) await btn.click({ timeout: 8000 });
  await pause(1000); await btn.click({ timeout: 8000 });
  await pause(1000); await btn.click({ timeout: 8000 });
  await pause(600);
  await page.getByRole('button', { name: '반응 닫기' }).click({ timeout: 8000 }).catch(() => page.keyboard.press('Escape'));
});
const arrangeRanking = (entry, target) => safe(entry, 'ranking', async (page) => {
  // Buttons are labelled "{n}번 {item} 위로 이동" (n = fixed item number).
  const names = target.map((item) => `${RANK_ITEMS.indexOf(item) + 1}번 ${item}`);
  const upButtons = page.locator('button[aria-label$=" 위로 이동"]');
  await upButtons.first().waitFor({ timeout: 15000 });
  const current = async () => (await upButtons.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label').replace(/ 위로 이동$/, ''))));
  for (let i = 0; i < names.length; i++) {
    for (let guard = 0; guard < names.length; guard++) {
      const order = await current(); const j = order.indexOf(names[i]);
      if (j <= i) break;
      await page.getByRole('button', { name: `${names[i]} 위로 이동`, exact: true }).click({ timeout: 8000 });
      await pause(150);
    }
  }
  const final = await current();
  if (final.join('|') !== names.join('|')) throw new Error(`order mismatch: ${final.join(',')}`);
  await page.getByRole('button', { name: '현재 순서로 순위 제출', exact: true }).click({ timeout: 8000 });
});
const openRankingSheet = (entry) => safe(entry, 'rankingSheet', async (page) => {
  await page.getByRole('button', { name: /랭킹/ }).first().click({ timeout: 10000 });
  await pause(1800);
  await page.keyboard.press('Escape');
});
const waitForStatus = async (entry, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const t = (await entry.page.locator('[role="status"][aria-live="polite"]').allTextContents().catch(() => [])).filter(Boolean); if (t.length) return t; await pause(100); } return []; };

// Admin helpers (dashboard page drives; presenter page just watches)
const activate = async (index) => {
  const page = pages.admin.page; const title = QUESTIONS[QIDS[index]].title;
  const card = page.getByLabel(`문항 관리: ${title}`, { exact: true }).first().locator('xpath=ancestor::div[.//button[@aria-label="질문 활성화"]][1]');
  const button = card.getByRole('button', { name: '질문 활성화', exact: true }).first();
  for (let attempt = 0; attempt < 3; attempt++) {
    await button.click({ timeout: 15000 });
    for (let i = 0; i < 80; i++) { if ((await db.ref(`sessions/${sid}/currentQuestion`).get()).val() === QIDS[index]) { await pages.board.page.evaluate(() => globalThis.__perf.resetCounts()); watchVotes(QIDS[index]); return; } await pause(50); }
    await page.screenshot({ path: path.join(OUT, `activate-fail-${QIDS[index]}-${attempt}.png`) });
    const dialogs = await page.getByRole('dialog').allInnerTexts().catch(() => []);
    log(`activate ${QIDS[index]} attempt ${attempt} no effect; dialogs=${JSON.stringify(dialogs).slice(0, 200)}`);
  }
  throw new Error(`activate ${QIDS[index]} did not take effect`);
};
const reveal = async () => { await pages.admin.page.getByRole('button', { name: '정답 공개', exact: true }).first().click({ timeout: 15000 }); };
// Mode changes, special ranks and break controls are driven from the presenter (발표 모드) page — what a teacher at the projector does.
async function chooseMode(label) {
  const page = pages.presenter.page;
  await page.getByRole('button', { name: '모드', exact: true }).first().click({ timeout: 15000 });
  await page.getByRole('button', { name: label, exact: true }).first().click({ timeout: 15000 });
}

// ---------- latency ----------
// DB arrival timeline (admin listener, same machine) vs board-rendered count per level: server→board propagation,
// independent of who voted. Sim acks give client→server round trip separately.
let voteWatch = null;
function watchVotes(qid) {
  if (voteWatch) voteWatch.ref.off('value', voteWatch.fn);
  const r = db.ref(`sessions/${sid}/questions/${qid}/votes`); const timeline = [];
  const fn = (snap) => { const v = snap.numChildren(); const l = timeline.at(-1); if (!l || l[1] !== v) timeline.push([Date.now(), v]); };
  r.on('value', fn); voteWatch = { ref: r, fn, timeline, qid };
}
async function latencyFor(label, acks) {
  await pause(2500);
  const raw = await pages.board.page.evaluate(() => globalThis.__perf.countTimeline);
  const dbTimeline = voteWatch?.timeline || [];
  const firstWrite = Math.min(...acks.map((a) => a.t));
  const board = raw.filter(([t, v]) => v === 0 || t >= firstWrite - 100);
  const levels = dbTimeline.filter(([, v]) => v > 0).map(([t, v]) => { const hit = board.find(([, bv]) => bv >= v); return hit ? Math.max(0, hit[0] - t) : null; });
  const prop = levels.filter((v) => v !== null);
  const ack = acks.filter((a) => a.ok).map((a) => a.ack - a.t);
  const r = { written: acks.filter((a) => a.ok).length, failed: acks.filter((a) => !a.ok).length, dbCount: dbTimeline.at(-1)?.[1] ?? 0, shownOnBoard: board.at(-1)?.[1] ?? 0,
    p50: pct(prop, 0.5), p95: pct(prop, 0.95), max: Math.max(0, ...prop), levels: prop.length, unmatchedLevels: levels.length - prop.length, ackP50: pct(ack, 0.5), ackP95: pct(ack, 0.95) };
  report.latency[label] = r; log(label, JSON.stringify(r)); save();
  return r;
}

(async () => {
  const imgServer = await startImageServer();
  const now = Date.now();
  await db.ref(`sessions/${sid}`).set({ creatorId: 'kim_teacher', courseId: 'course_demo', courseName: `최종 검증 ${N}명`, createdAt: now, startedAt: now, status: 'active', currentMode: 'waiting', currentQuestion: null, roundNumber: 1, questions: QUESTIONS });
  browser = await chromium.launch({ headless: true, args: ['--enable-experimental-web-platform-features'] });

  // Admin dashboard (driver) + presenter (recorded) share one logged-in context
  const adminCtx = await browser.newContext({ viewport: { width: 1512, height: 945 }, deviceScaleFactor: 1 });
  contexts.push({ ctx: adminCtx, name: 'adminctx' });
  const adminPage = await adminCtx.newPage(); wireErrors(adminPage, 'admin');
  await adminPage.addInitScript(instrument, {});
  pages.admin = { page: adminPage, cdp: await adminCtx.newCDPSession(adminPage), name: 'admin', videoStart: 0 };
  await pages.admin.cdp.send('Performance.enable');
  await loginTeacher(adminPage);
  await adminPage.goto(`${BASE}/admin?s=${sid}`);
  await adminPage.getByRole('button', { name: '질문 활성화', exact: true }).first().waitFor({ timeout: 30000 });

  const presenter = await newPage('presenter', { viewport: { width: 1920, height: 1080 }, record: true });
  await loginTeacher(presenter.page);
  await presenter.page.goto(`${BASE}/admin?s=${sid}`);
  await presenter.page.getByRole('button', { name: /^발표 모드$|^발표$/ }).first().click({ timeout: 30000 });
  await pause(1500);
  const board = await newPage('board', { viewport: { width: 1920, height: 1080 }, record: true, sampleCounts: true });
  await board.page.goto(`${BASE}/live?s=${sid}`);
  await board.page.getByText(/접속 중|기다리는 중/).first().waitFor({ timeout: 30000 });
  await pause(1000);

  // Real students: phones (half throttled 4x) + laptops. Two are recorded.
  const realSpecs = Array.from({ length: REAL }, (_, i) => {
    const phone = i < Math.ceil(REAL * 0.6);
    return { name: `real${String(i + 1).padStart(2, '0')}`, viewport: phone ? { width: 390, height: 844 } : { width: 1366, height: 768 }, mobile: phone, throttle: phone && i % 2 === 0 ? 4 : 0, record: i === 0 || i === Math.ceil(REAL * 0.6) };
  });
  for (const spec of realSpecs) { const e = await newPage(spec.name, spec); e.nickname = `폰${String(realStudents.length + 1).padStart(2, '0')}`; realStudents.push(e); }
  const throttled = realStudents.filter((r) => r.throttle > 1);
  const recordedPhone = realStudents[0]; const recordedLaptop = realStudents.find((r) => !r.mobile) || realStudents[1];
  report.recorded = { board: 'board', presenter: 'presenter', phone: `${recordedPhone.name} (${recordedPhone.viewport ? '' : ''}390x844, cpu x${recordedPhone.throttle || 1})`, laptop: recordedLaptop.name };

  // ===== Phase 1: waiting page, 200 joins in bursts =====
  await setPhase('join');
  const joinT0 = Date.now();
  const simIdx = Array.from({ length: N - REAL }, (_, i) => i);
  const bursts = 4; const per = Math.ceil(simIdx.length / bursts); const realPer = Math.ceil(REAL / bursts);
  let joinedReal = 0;
  for (let b = 0; b < bursts; b++) {
    const slice = simIdx.slice(b * per, (b + 1) * per);
    const reals = realStudents.slice(b * realPer, (b + 1) * realPer);
    await Promise.all([
      pool(slice, 30, async (i) => { try { sims[i] = await makeSim(i); } catch (e) { simError(`join:${e.code || e.message}`); } }),
      ...reals.map(async (r) => { if (await joinReal(r, r.nickname)) joinedReal += 1; }),
    ]);
    mark(`join-burst-${b + 1}`, ['board', recordedPhone.name]);
    await dwell(4000);
  }
  const joinMs = Date.now() - joinT0;
  await dwell(6000);
  const onlineTimeline = await board.page.evaluate(() => globalThis.__perf.onlineTimeline);
  report.checks.join = { simJoined: sims.filter(Boolean).length, realJoined: joinedReal, joinMs, boardOnlineFinal: onlineTimeline.at(-1)?.[1] ?? null, boardOnlineSteps: onlineTimeline.length, dbParticipants: (await db.ref(`sessions/${sid}/participants`).get()).numChildren() };
  log('join', JSON.stringify(report.checks.join)); save();
  report.phases.joinBoardMem = await metrics(board);

  // ===== Phase 2: photo quiz =====
  await setPhase('photoQuiz');
  await activate(0);
  await board.page.locator('[data-correct]').first().waitFor({ timeout: 20000 }).catch(() => {});
  mark('photo-quiz-shown', ['board', 'presenter', recordedPhone.name]);
  await dwell(3000);
  const liveSims = sims.filter(Boolean);
  // Reconnect drill: 6 sims lose network for 10s mid-answer, their vote lands after restore
  const dropped = liveSims.slice(10, 16);
  const quizAcks = [];
  const offlineRun = (async () => {
    await pause(4000);
    dropped.forEach((s) => goOffline(s.db));
    const pendingVotes = dropped.map((s) => simVote(s, 'q_photo', 'OFFLINE-' + OPTIONS_PHOTO[1]).then((r) => ({ ...r, offline: true })));
    await pause(10000);
    dropped.forEach((s) => goOnline(s.db));
    const results = await Promise.all(pendingVotes);
    const reconnectT0 = Date.now();
    for (let i = 0; i < 400 && !dropped.every((s) => s.connected); i++) await pause(25);
    report.checks.reconnect = { dropped: dropped.length, reconnectedWithin: Date.now() - reconnectT0, allConnected: dropped.every((s) => s.connected), offlineVotesAcked: results.filter((r) => r.ok).length };
    quizAcks.push(...results);
  })();
  const others = liveSims.filter((s) => !dropped.includes(s));
  const quizVotes = others.map(async (s, i) => { await pause(rand() * 20000); const v = OPTIONS_PHOTO[i % 5 === 0 ? 0 : i % 3 === 0 ? 2 : 1]; quizAcks.push(await simVote(s, 'q_photo', v)); });
  const realQuiz = realStudents.map(async (r, i) => { await pause(1000 + rand() * 12000); await tapQuizOption(r, i % 4 === 3 ? 0 : 1); });
  // Reactions burst: 3 in a row then 1/s, staggered through the answer window
  const reactTypes = ['thumbsup', 'fire', 'heart', 'laugh', 'clap'];
  let reactSent = 0, reactOk = 0;
  const reactRun = Promise.all(liveSims.map(async (s, i) => {
    await pause(3000 + rand() * 14000);
    const type = reactTypes[i % 5];
    for (let k = 0; k < 3; k++) { reactSent += 1; if (await simReact(s, type)) reactOk += 1; }
    for (let k = 0; k < 2; k++) { await pause(1000); reactSent += 1; if (await simReact(s, type)) reactOk += 1; }
  }));
  const realReact = realStudents.slice(0, 6).map(async (r, i) => { await pause(6000 + i * 1500); await sendReactions(r, ['좋아요', '열정', '하트', '재밌어요', '축하해요'][i % 5]); });
  await pause(8000); mark('reactions-burst', ['board', 'presenter']);
  await Promise.all([...quizVotes, ...realQuiz, reactRun, ...realReact, offlineRun]);
  await latencyFor('photoQuiz', quizAcks);
  report.checks.reactions = { sent: reactSent, ok: reactOk, stored: (await db.ref(`sessions/${sid}/reactions`).get()).numChildren() };
  report.phases.quizBoardMem = await metrics(board);
  // Reveal: glow on board, score-gain overlay on phones
  await setPhase('photoReveal');
  const revealT0 = Date.now();
  await reveal();
  await board.page.locator('[data-correct="true"].answer-glow').first().waitFor({ timeout: 15000 }).catch(() => {});
  report.checks.revealGlowMs = Date.now() - revealT0;
  mark('reveal-glow', ['board', 'presenter', recordedPhone.name, recordedLaptop.name]);
  const statusPromise = Promise.all([recordedPhone, throttled[1] || recordedLaptop].map((e) => waitForStatus(e, 4000)));
  await pause(700); mark('reveal-glow+0.7s', ['board', recordedPhone.name]);
  await pause(500); mark('score-overlay', [recordedPhone.name, recordedLaptop.name]);
  report.checks.scoreOverlayAnnouncement = await statusPromise;
  await dwell(8000);

  // ===== Phase 3: ranking =====
  await setPhase('ranking');
  await activate(1);
  await board.page.locator('[data-ranking-board]').first().waitFor({ timeout: 20000 }).catch(() => {});
  mark('ranking-shown', ['board', recordedPhone.name]);
  await dwell(3000);
  const perms = ['0,2,3,1', '1,0,3,2', '3,2,1,0', '0,1,2,3', '2,3,0,1', '0,2,1,3'];
  const rankAcks = [];
  const rankSims = liveSims.map(async (s, i) => {
    await pause(rand() * 25000);
    const value = i % 10 < 5 ? RANK_ANSWER : i % 10 < 8 ? perms[1 + (i % 5)] : (i % 2 ? '0,2' : '0,2,3');
    rankAcks.push(await simVote(s, 'q_rank', value));
  });
  const rankReal = realStudents.map(async (r, i) => { await pause(1000 + rand() * 10000); await arrangeRanking(r, i % 3 === 2 ? ['여름', '봄', '겨울', '가을'] : ['봄', '가을', '겨울', '여름']); });
  await Promise.all([...rankSims, ...rankReal]);
  await latencyFor('ranking', rankAcks);
  await setPhase('rankingReveal');
  await reveal();
  await board.page.locator('[data-ranking-board="answer"]').waitFor({ timeout: 15000 }).catch(() => {});
  mark('ranking-reveal', ['board', 'presenter', recordedPhone.name, recordedLaptop.name]);
  await pause(500); mark('ranking-reveal+0.5s', ['board', recordedPhone.name]);
  await pause(1500); mark('ranking-reveal+2s', ['board', recordedPhone.name]);
  await dwell(6000);
  report.checks.rankingPhoneResult = { phone: await recordedPhone.page.locator('[data-ranking-result]').getAttribute('data-ranking-result').catch(() => null), hits: await recordedPhone.page.locator('[data-ranking-hit="true"]').count().catch(() => null) };
  await pause(3000);

  // ===== Phase 4: choice / wordcloud / scale quickly =====
  await setPhase('choice');
  await activate(2); await dwell(2500); mark('choice-shown', ['board']);
  const choiceAcks = [];
  await Promise.all([
    ...liveSims.map(async (s, i) => { await pause(rand() * 10000); choiceAcks.push(await simVote(s, 'q_choice', CHOICE[i % 4])); }),
    ...realStudents.map(async (r, i) => { await pause(500 + rand() * 6000); await tapChoice(r, CHOICE[i % 4]); }),
  ]);
  mark('choice-bars', ['board']);
  await latencyFor('choice', choiceAcks);

  await setPhase('wordcloud');
  await activate(3); await dwell(2500);
  const wordAcks = [];
  await Promise.all([
    ...liveSims.map(async (s, i) => { await pause(rand() * 10000); wordAcks.push(await simVote(s, 'q_word', WORDS[(i * 7) % WORDS.length])); }),
    ...realStudents.map(async (r, i) => { await pause(500 + rand() * 6000); await typeWord(r, WORDS[i % WORDS.length]); }),
  ]);
  mark('wordcloud', ['board']);
  await latencyFor('wordcloud', wordAcks);

  await setPhase('scale');
  await activate(4); await dwell(2500);
  const scaleAcks = [];
  await Promise.all([
    ...liveSims.map(async (s, i) => { await pause(rand() * 10000); scaleAcks.push(await simVote(s, 'q_scale', String([0, 25, 50, 75, 100][i % 5]))); }),
    ...realStudents.map(async (r, i) => { await pause(500 + rand() * 6000); await tapScale(r, [0, 25, 50, 75, 100][i % 5]); }),
  ]);
  mark('scale', ['board']);
  await latencyFor('scale', scaleAcks);
  report.phases.pollsBoardMem = await metrics(board);

  // ===== Phase 5: leaderboard + special ranks 1,2,3,27 =====
  await setPhase('leaderboard');
  await chooseMode('랭킹');
  await board.page.locator('[data-rank]').first().waitFor({ timeout: 20000 }).catch(() => {});
  await pause(800); mark('leaderboard-shown', ['board', 'presenter', recordedPhone.name]);
  await dwell(4000);
  const adminP = pages.presenter.page;
  await adminP.getByRole('button', { name: '특별 순위 설정', exact: true }).first().click({ timeout: 15000 });
  const dialog = adminP.getByRole('dialog', { name: '특별 순위 설정', exact: true });
  const ranks = N >= 27 ? [1, 2, 3, 27] : [1, 2, 3, Math.min(7, N)];
  await dialog.getByLabel('특별 순위', { exact: true }).fill(ranks.join(', '));
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await dialog.waitFor({ state: 'hidden', timeout: 10000 });
  const rankSequence = [];
  for (let i = 0; i < 4; i++) {
    await dwell(i === 0 ? 2000 : 6000);
    await adminP.getByRole('button', { name: /^특별 순위 공개/ }).click({ timeout: 15000 });
    await pause(700);
    rankSequence.push((await db.ref(`sessions/${sid}/leaderboardHighlight/activeRank`).get()).val());
    mark(`special-rank-${rankSequence.at(-1)}`, ['board', 'presenter', recordedPhone.name]);
    await pause(900); mark(`special-rank-${rankSequence.at(-1)}+1.6s`, ['board']);
  }
  report.checks.specialRankSequence = rankSequence;
  await Promise.all(realStudents.slice(0, 6).map((r, i) => pause(i * 300).then(() => openRankingSheet(r))));
  await dwell(5000);
  report.phases.leaderboardBoardMem = await metrics(board);

  // ===== Phase 6: break time (start-at) =====
  await setPhase('break');
  await chooseMode('쉬는·대기 시간');
  await adminP.getByRole('radio', { name: '시작 시각', exact: true }).first().check({ timeout: 15000 }).catch(() => adminP.getByText('시작 시각', { exact: true }).first().click());
  await adminP.getByRole('button', { name: '5분', exact: true }).first().click({ timeout: 10000 }).catch(() => {});
  await adminP.getByRole('button', { name: /분 뒤 시작으로 표시/ }).first().click({ timeout: 10000 });
  await pause(2500); mark('break-clock', ['board', 'presenter', recordedPhone.name]);
  await pause(12000); mark('break-clock+14s', ['board']);
  await dwell(20000);
  await adminP.getByRole('button', { name: '타이머 끄기', exact: true }).first().click({ timeout: 10000 }).catch(() => {});

  // ===== Phase 7: end class =====
  await setPhase('end');
  await pages.admin.page.getByRole('button', { name: '종료', exact: true }).first().click({ timeout: 15000 });
  await pages.admin.page.getByRole('dialog').getByRole('button', { name: /^확인$|종료/ }).last().click({ timeout: 10000 });
  await pause(3000); mark('class-ended', ['board', recordedPhone.name, recordedLaptop.name]);
  await dwell(6000);
  await setPhase('done');

  // ===== Verification =====
  const snap = (await db.ref(`sessions/${sid}`).get()).val();
  const votesOf = (q) => Object.values(snap.questions?.[q]?.votes || {});
  const scores = snap.scores || {};
  const scoreRows = Object.values(scores);
  const inconsistent = scoreRows.filter((r) => r.total !== Object.values(r.quizAwards || {}).reduce((a, c) => a + (c.points || 0), 0));
  const photoVotes = votesOf('q_photo');
  const correctPhoto = photoVotes.filter((v) => v.value === '설악산').length;
  const rankVotes = votesOf('q_rank');
  report.checks.votes = Object.fromEntries(QIDS.map((q) => [q, { db: votesOf(q).length, writtenBySims: report.latency[{ q_photo: 'photoQuiz', q_rank: 'ranking', q_choice: 'choice', q_word: 'wordcloud', q_scale: 'scale' }[q]]?.written }]));
  report.checks.scores = { scored: scoreRows.length, inconsistent: inconsistent.length, awardedPositive: scoreRows.filter((r) => r.total > 0).length, correctPhotoVotes: correctPhoto, maxTotal: Math.max(0, ...scoreRows.map((r) => r.total)), sampleInconsistent: inconsistent.slice(0, 2) };
  report.checks.ranking = { votes: rankVotes.length, correct: rankVotes.filter((v) => v.value === RANK_ANSWER).length, partial: rankVotes.filter((v) => v.value.split(',').length < 4).length, revealedAt: snap.questions.q_rank.revealedAt, publicRevealed: snap.publicQuestions?.q_rank?.revealedAt, publicAnswer: snap.publicQuestions?.q_rank?.correctAnswer };
  report.checks.session = { status: snap.status, currentMode: snap.currentMode, breakStyle: snap.breakStyle, publicQuestions: Object.keys(snap.publicQuestions || {}).length };
  report.checks.offlineVotesInDb = photoVotes.filter((v) => String(v.value).startsWith('OFFLINE-')).length;
  report.checks.realPhoneOverlay = report.checks.scoreOverlayAnnouncement;

  // ===== Perf summaries =====
  for (const [name, e] of Object.entries(pages)) {
    report.phases[name] = await e.page.evaluate(() => globalThis.__perf?.summary?.() || null).catch(() => null);
    if (e.cdp) report.phases[`${name}Mem`] = await metrics(e).catch(() => null);
  }
  report.phases.throttledPhones = throttled.map((t) => t.name);
  report.endedAt = new Date().toISOString();
  save();

  // ===== Close pages so videos flush; map video paths =====
  const videoPaths = {};
  for (const [name, e] of Object.entries(pages)) { const v = e.page.video?.(); if (v) videoPaths[name] = { promise: v.path(), start: e.videoStart }; }
  await Promise.all(contexts.map((c) => c.ctx.close().catch(() => {})));
  report.videos = {};
  for (const [name, v] of Object.entries(videoPaths)) { const p = await v.promise; const target = path.join(VIDEO_DIR, `${name}.webm`); try { fs.renameSync(p, target); } catch { /* keep */ } report.videos[name] = { path: target, start: v.start }; }
  await browser.close();
  save();
  log('report', path.join(OUT, 'report.json'));
  imgServer.close();
  await Promise.allSettled(sims.filter(Boolean).map((s) => deleteApp(s.app)));
  await admin.deleteApp(app);
  process.exit(0);
})().catch(async (e) => { console.error(e); report.fatal = String(e.stack || e); save(); try { await Promise.all(contexts.map((c) => c.ctx.close().catch(() => {}))); await browser?.close(); } catch { /* ignore */ } process.exit(1); });
