const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const { chromium, expect } = require('@playwright/test');

if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000'
  || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') {
  throw new Error('Quiz event selection QA requires local demo Auth/Database emulators.');
}
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5175';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error('Loopback QA origin required');
const root = path.resolve(__dirname, '../..');
const deps = createRequire(path.join(root, 'functions/package.json'));
const { initializeApp, deleteApp } = deps('firebase-admin/app');
const { getDatabase } = deps('firebase-admin/database');
const { getAuth } = deps('firebase-admin/auth');
const app = initializeApp({ projectId: 'demo-dorandoran', databaseURL: 'https://demo-dorandoran.firebaseio.com' });
const db = getDatabase(app);
const prefix = `qa_event_selection_${process.pid}`;
const artifacts = path.join(process.env.QA_ARTIFACT_DIR || os.tmpdir(), `dorandoran-event-selection-${process.pid}`);
fs.mkdirSync(artifacts, { recursive: true });
const fields = require('../../functions/public-question-fields.json');
const event = { id: 'double-points', pointMultiplier: 2 };
const sessionIds = [], learnerIds = new Set();
const report = { cases: [], screenshots: [], errors: [], modelRequests: [] };
let browser;

function save() {
  fs.writeFileSync(path.join(artifacts, 'manifest.json'), JSON.stringify(report, null, 2));
}

async function shot(page, name) {
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(artifacts, file) });
  report.screenshots.push({ file, name, text: await page.locator('body').innerText() });
  save();
}

async function quizSnapshot(sid, id) {
  const [privateQuestion, publicQuestion, pending] = await Promise.all([
    db.ref(`sessions/${sid}/questions/${id}`).get(),
    db.ref(`sessions/${sid}/publicQuestions/${id}`).get(),
    db.ref(`sessions/${sid}/pendingEvent`).get(),
  ]);
  return { question: privateQuestion.val(), publicQuestion: publicQuestion.val(), pending: pending.val() };
}

async function checkQuizEvent(sid, id, multiplier) {
  await expect.poll(async () => {
    const state = await quizSnapshot(sid, id);
    return {
      privateMultiplier: state.question?.event?.pointMultiplier || null,
      publicMultiplier: state.publicQuestion?.event?.pointMultiplier || null,
      pending: state.pending,
    };
  }).toEqual({ privateMultiplier: multiplier, publicMultiplier: multiplier, pending: null });
}

async function answerAndReveal(teacher, learner, sid, uid, id, expectedTotal, points, eventMultiplier) {
  await expect(learner.getByRole('heading', { name: `활동 ${id}`, exact: true })).toBeVisible();
  await learner.getByRole('button', { name: /협업/ }).click();
  await expect.poll(async () => (await db.ref(`sessions/${sid}/questions/${id}/votes/${uid}/value`).get()).val()).toBe('협업');
  await teacher.getByRole('button', { name: '정답 공개', exact: true }).first().click();
  await expect.poll(async () => (await db.ref(`sessions/${sid}/scores/${uid}/total`).get()).val()).toBe(expectedTotal);
  await expect.poll(async () => (await db.ref(`sessions/${sid}/scores/${uid}/quizAwards/${id}/points`).get()).val()).toBe(points);
  await expect(learner.getByText(`+${points}점`, { exact: true })).toBeVisible();
  await checkQuizEvent(sid, id, eventMultiplier);
  await shot(learner, `${sid}-${id}-${points}points`);
  return {
    id, points, total: expectedTotal,
    event: (await db.ref(`sessions/${sid}/questions/${id}/event`).get()).val(),
  };
}

async function selectDouble(teacher, sid) {
  await teacher.locator('summary').filter({ hasText: '다음 퀴즈 이벤트' }).click();
  await teacher.getByRole('button', { name: '2배 점수', exact: true }).click();
  await expect.poll(async () => (await db.ref(`sessions/${sid}/pendingEvent/pointMultiplier`).get()).val()).toBe(2);
  await expect(teacher.locator('summary').filter({ hasText: '다음 퀴즈 이벤트' })).toContainText('2배 점수');
}

async function runCase(mode) {
  const sid = `${prefix}_${mode}`;
  sessionIds.push(sid);
  const quiz = id => ({ type: 'quiz', title: `활동 ${id}`, options: ['협업', '독점'], correctAnswer: '협업', points: 100, maxSpeedBonus: 0, betting: false });
  const questions = {
    intro: { type: 'choice', title: '도입 설문', options: ['준비', '기대'], order: 0 },
    one: { ...quiz('one'), order: 1 },
    two: { ...quiz('two'), order: 2 },
    authored: { ...quiz('authored'), order: 3, event },
  };
  await db.ref(`sessions/${sid}`).set({
    creatorId: 'legacy_master', courseId: 'course_a', courseName: '독립 이벤트 선택 회귀',
    createdAt: Date.now(), startedAt: Date.now(), status: 'active', aiEnabled: false,
    currentMode: 'poll', currentQuestion: 'intro', questions,
    publicQuestions: Object.fromEntries(Object.entries(questions).map(([id, question]) => [id,
      Object.fromEntries(fields.filter(field => question[field] != null).map(field => [field, question[field]]))])),
  });
  const controller = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const mobile = await browser.newContext({ viewport: { width: 320, height: 844 }, isMobile: true, hasTouch: true });
  try {
    for (const context of [controller, mobile]) {
      await context.route('**/api/gemini/**', route => {
        const url = new URL(route.request().url());
        if (url.pathname.endsWith('/status')) return route.continue();
        report.modelRequests.push(url.pathname);
        return route.abort();
      });
      await context.route('**/generativelanguage.googleapis.com/**', route => {
        report.modelRequests.push(new URL(route.request().url()).pathname);
        return route.abort();
      });
    }
    const teacher = await controller.newPage(), learner = await mobile.newPage();
    for (const page of [teacher, learner]) {
      page.setDefaultTimeout(10000);
      page.on('pageerror', error => report.errors.push({ mode, message: error.message }));
    }
    await teacher.goto(`${base}/admin?s=${sid}`);
    await teacher.getByPlaceholder('아이디').fill('qa-master');
    await teacher.getByPlaceholder('비밀번호').fill('TestFixture-Only-Strong8');
    await teacher.getByRole('button', { name: '로그인', exact: true }).click();
    await expect(teacher.getByRole('button', { name: '발표 모드', exact: true })).toBeVisible();
    await selectDouble(teacher, sid);
    await shot(teacher, `${sid}-armed`);
    if (mode === 'reload') {
      await teacher.reload();
      await expect(teacher.getByRole('button', { name: '발표 모드', exact: true })).toBeVisible();
      await expect(teacher.locator('summary').filter({ hasText: '다음 퀴즈 이벤트' })).toContainText('2배 점수');
    } else if (mode === 'presenter') {
      await teacher.getByRole('button', { name: '발표 모드', exact: true }).click();
    } else if (mode === 'cancel') {
      await teacher.getByRole('button', { name: '2배 점수', exact: true }).click();
      await expect.poll(async () => (await db.ref(`sessions/${sid}/pendingEvent`).get()).val()).toBeNull();
    }
    await teacher.getByRole('button', { name: '다음 활동', exact: true }).first().click();
    await expect.poll(async () => (await db.ref(`sessions/${sid}/currentQuestion`).get()).val()).toBe('one');
    const multiplier = mode === 'cancel' ? null : 2;
    await checkQuizEvent(sid, 'one', multiplier);
    await learner.goto(`${base}/?s=${sid}`);
    await learner.getByPlaceholder('닉네임 입력').fill('이벤트학생');
    await learner.getByRole('button', { name: '참여하기', exact: true }).click();
    await expect(learner.getByRole('heading', { name: '활동 one', exact: true })).toBeVisible();
    const uid = await learner.evaluate(async () => {
      const { auth } = await import('/src/lib/auth-session.js');
      if (!auth.currentUser?.isAnonymous) throw new Error('Fresh anonymous learner required');
      return auth.currentUser.uid;
    });
    learnerIds.add(uid);
    // Event presence must reach the phone as well as both database views.
    const firstScreen = await learner.locator('body').innerText();
    expect(firstScreen.includes('2배 점수')).toBe(mode !== 'cancel');
    const firstPoints = mode === 'cancel' ? 100 : 200;
    const awards = [await answerAndReveal(teacher, learner, sid, uid, 'one', firstPoints, firstPoints, multiplier)];
    if (mode === 'immediate' || mode === 'presenter') {
      // The armed event is single-use. The following ordinary quiz stays at100.
      await teacher.getByRole('button', { name: '다음 활동', exact: true }).first().click();
      await expect.poll(async () => (await db.ref(`sessions/${sid}/currentQuestion`).get()).val()).toBe('two');
      awards.push(await answerAndReveal(teacher, learner, sid, uid, 'two', 300, 100, null));
      // A question's own pre-authored event survives without a new pending event,
      // including the Presenter goToQuestion path which previously erased it.
      await teacher.getByRole('button', { name: '다음 활동', exact: true }).first().click();
      await expect.poll(async () => (await db.ref(`sessions/${sid}/currentQuestion`).get()).val()).toBe('authored');
      awards.push(await answerAndReveal(teacher, learner, sid, uid, 'authored', 500, 200, 2));
    }
    report.cases.push({ mode, sid, pendingConsumed: true, awards, pass: true });
    save();
    console.log(`PASS ${mode}: ${awards.map(award => award.points).join('/')} points`);
  } finally {
    await controller.close();
    await mobile.close();
  }
}

(async () => {
  const started = Date.now();
  try {
    browser = await chromium.launch(process.platform === 'darwin' ? { channel: 'chrome' } : {});
    for (const mode of ['immediate', 'reload', 'presenter', 'cancel']) await runCase(mode);
    expect(report.errors).toEqual([]);
    expect(report.modelRequests).toEqual([]);
    report.durationMs = Date.now() - started;
    save();
    console.log(JSON.stringify({ result: 'PASS', cases: report.cases, durationMs: report.durationMs, artifacts }));
  } finally {
    if (browser) await browser.close();
    try {
      for (const sid of sessionIds) await db.ref(`sessions/${sid}`).remove();
      for (const uid of learnerIds) await getAuth(app).deleteUser(uid);
    } finally {
      await deleteApp(app);
    }
  }
})().catch(error => {
  report.error = error.message;
  save();
  console.error(error);
  process.exitCode = 1;
});
