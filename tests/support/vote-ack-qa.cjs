// A real SDK/browser regression check. Only its own demo-emulator fixture is mutated.
const { chromium, expect } = require('@playwright/test');
const { createRequire } = require('node:module');
const { resolve, join } = require('node:path');
const { tmpdir } = require('node:os');
const { mkdirSync } = require('node:fs');

if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000'
    || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') {
  throw new Error('Vote ACK QA requires the localhost demo emulators.');
}
const dependency = createRequire(resolve(__dirname, '../../functions/package.json'));
const { initializeApp, deleteApp } = dependency('firebase-admin/app');
const { getDatabase } = dependency('firebase-admin/database');
const app = initializeApp({ projectId: 'demo-dorandoran', databaseURL: 'https://demo-dorandoran.firebaseio.com' });
const database = getDatabase(app);
const sid = 'qa_vote_ack_regression';
const fixture = database.ref(`sessions/${sid}`);
const base = 'http://127.0.0.1:5175';
const screenshots = join(tmpdir(), `dorandoran-vote-ack-${process.pid}`);
mkdirSync(screenshots, { recursive: true });
const pageErrors = [], unexpectedConsoleErrors = [], expectedPermissionDenials = [], modelRequests = [];
let browser, page, uid;

async function capture(name) { await page.screenshot({ path: join(screenshots, `${name}.png`) }); }
async function offline(enabled) {
  await page.evaluate(async (value) => {
    const { db } = await import('/src/lib/firebase.js');
    const sdk = await import('/node_modules/.vite/deps/firebase_database.js');
    value ? sdk.goOffline(db) : sdk.goOnline(db);
  }, enabled);
}
async function activate(questionId) {
  await fixture.update({ currentMode: questionId === 'quiz' ? 'quiz' : 'poll', currentQuestion: questionId });
  await expect(page.getByRole('heading', { name: `ACK 점검 ${questionId}`, exact: true })).toBeVisible();
}
const storedVote = (questionId) => fixture.child(`questions/${questionId}/votes/${uid}`);

(async () => {
  try {
    const seed = (await database.ref('sessions/qa_room').get()).val();
    if (!seed) throw new Error('Missing qa_room demo seed.');
    const now = Date.now();
    const questions = Object.fromEntries(['choice', 'quiz', 'ox'].map((type, order) => [type, {
      title: `ACK 점검 ${type}`, type, options: type === 'ox' ? ['O', 'X'] : ['선택 A', '선택 B'], order, activatedAt: now,
    }]));
    // The correct answer remains private; no model or AI feature is needed.
    await fixture.set({ creatorId: seed.creatorId || 'legacy_master', courseId: seed.courseId || 'course_a',
      courseName: '저장 확인 회귀 점검', createdAt: now, startedAt: now, status: 'active', currentMode: 'waiting',
      aiEnabled: false, questions: { ...questions, quiz: { ...questions.quiz, correctAnswer: '선택 B' } }, publicQuestions: questions });
    browser = await chromium.launch(process.platform === 'darwin' ? { channel: 'chrome' } : {});
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await context.route('**/api/gemini/**', async route => {
      if (route.request().url().endsWith('/status')) return route.continue();
      modelRequests.push(route.request().url());
      return route.abort();
    });
    page = await context.newPage();
    page.setDefaultTimeout(8000);
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => {
      if (!['error', 'warning'].includes(message.type())) return;
      if (/permission[_ -]?denied/i.test(message.text())) expectedPermissionDenials.push(message.text());
      else if (message.type() === 'error') unexpectedConsoleErrors.push(message.text());
    });
    await page.goto(base);
    expect(await page.evaluate(async () => {
      const { app } = await import('/src/lib/firebase.js');
      const { auth } = await import('/src/lib/auth-session.js');
      return app.options.projectId === 'demo-dorandoran' && auth.emulatorConfig?.host === '127.0.0.1' && auth.emulatorConfig?.port === 9099;
    })).toBe(true);
    await page.goto(`${base}/?s=${sid}`);
    await page.getByPlaceholder('닉네임 입력').fill('저장확인QA');
    await page.getByRole('button', { name: '참여하기', exact: true }).click();
    await expect(page.getByRole('button', { name: '학습자 설정' })).toBeVisible();
    uid = await page.evaluate(async () => (await import('/src/lib/auth-session.js')).auth.currentUser.uid);

    for (const type of ['choice', 'quiz', 'ox']) {
      await activate(type);
      try {
        await offline(true);
        await page.getByRole('button', { name: type === 'ox' ? 'O 맞아요' : 'A 선택 A', exact: true }).click();
        await page.waitForTimeout(250); // Let Firebase's optimistic onValue and React effects run.
        expect((await storedVote(type).get()).val()).toBeNull();
        const text = await page.locator('body').innerText();
        for (const confirmation of ['투표 완료!', '답안 제출 완료!', '응답이 기록되었습니다', '결과를 기다리는 중...', '정답 공개를 기다리는 중...']) {
          expect(text).not.toContain(confirmation);
        }
        await capture(`${type}-pending`);
      } finally { await offline(false); }
      await expect.poll(async () => (await storedVote(type).get()).val()?.value).toBe(type === 'ox' ? 'O' : '선택 A');
      await expect(page.getByText(type === 'ox' ? 'O (맞아요)' : 'A. 선택 A', { exact: true })).toBeVisible();
    }

    // Keep public UI open while the private server state rejects the write.
    const retry = { ...questions.choice, title: 'ACK 점검 retry', order: 2 };
    await fixture.update({ 'questions/retry': retry, 'publicQuestions/retry': retry });
    await activate('retry');
    await fixture.child('questions/retry/revealedAt').set(Date.now());
    await page.getByRole('button', { name: 'A 선택 A', exact: true }).click();
    await expect(page.getByText('투표에 실패했습니다. 다시 선택해주세요.', { exact: true })).toBeVisible();
    expect((await storedVote('retry').get()).val()).toBeNull();
    await capture('rejected');
    await fixture.child('questions/retry/revealedAt').remove();
    await page.getByRole('button', { name: 'B 선택 B', exact: true }).click();
    await expect.poll(async () => (await storedVote('retry').get()).val()?.value).toBe('선택 B');

    await fixture.update({ currentMode: 'quickSurvey', currentQuestion: null });
    await expect(page.getByText('빠른 설문', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '4', exact: true }).click();
    await expect.poll(async () => (await fixture.child(`quickSurvey/${uid}/rating`).get()).val()).toBe(4);
    await expect(page.getByText('응답이 기록되었습니다', { exact: true })).toBeVisible();
    await fixture.child('quickSurvey').remove(); // The instructor's real reset operation.
    await expect.poll(async () => (await fixture.child('quickSurvey').get()).val()).toBeNull();
    await expect(page.getByRole('button', { name: '5', exact: true })).toBeEnabled();
    await expect(page.getByText('응답이 기록되었습니다', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '5', exact: true }).click();
    await expect.poll(async () => (await fixture.child(`quickSurvey/${uid}/rating`).get()).val()).toBe(5);
    await expect(page.getByText('응답이 기록되었습니다', { exact: true })).toBeVisible();
    await capture('survey-reset-answered');
    expect(pageErrors).toEqual([]);
    expect(unexpectedConsoleErrors).toEqual([]);
    expect(modelRequests).toEqual([]);
    expect(expectedPermissionDenials.length).toBeGreaterThan(0);
    console.log(JSON.stringify({ result: 'PASS', offlineAck: ['choice', 'quiz', 'ox'], rejectedThenRetried: true,
      surveyResetThenAnswered: true, expectedPermissionDenials: expectedPermissionDenials.length, pageErrors, modelRequests, screenshots }));
  } finally {
    if (browser) await browser.close();
    await fixture.remove(); // Only this script's namespace; no source fixtures or production data.
    await deleteApp(app);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
