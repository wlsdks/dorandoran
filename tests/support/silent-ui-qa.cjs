if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('Local demo emulators required');
const { chromium, expect } = require('@playwright/test');
const dep = require('node:module').createRequire(require('node:path').resolve(__dirname, '../../functions/package.json'));
const { initializeApp, deleteApp } = dep('firebase-admin/app'); const { getDatabase } = dep('firebase-admin/database');
const app = initializeApp({ projectId: 'demo-dorandoran', databaseURL: 'https://demo-dorandoran.firebaseio.com' }, 'silent-qa'), db = getDatabase(app), sid = 'qa_silent_classroom'; let browser;
(async () => {
  const questions = { choice: { type: 'choice', title: '소리 없는 수업', options: ['A', 'B'], order: 0 }, quiz: { type: 'quiz', title: '정답을 고르세요', options: ['A', 'B'], correctAnswer: 'A', points: 100, maxSpeedBonus: 0, betting: false, order: 1 } };
  await db.ref(`sessions/${sid}`).set({ creatorId: 'legacy_master', createdAt: 1, status: 'active', currentMode: 'poll', currentQuestion: 'choice', courseName: '시각 피드백 검증', questions });
  browser = await chromium.launch(process.platform === 'darwin' ? { channel: 'chrome' } : {}); const pages = [], errors = [];
  for (const role of ['teacher', 'board', 'student']) {
    const context = await browser.newContext({ viewport: role === 'student' ? { width: 390, height: 844 } : { width: 1366, height: 768 } });
    await context.addInitScript(() => { window.__audioCreated = 0; const Original = window.AudioContext; if (Original) window.AudioContext = class extends Original { constructor(...args) { super(...args); window.__audioCreated++; } }; });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    if (role === 'teacher') { await page.goto('http://127.0.0.1:5175/admin'); await page.getByPlaceholder('아이디').fill('qa-master'); await page.getByPlaceholder('비밀번호').fill('TestFixture-Only-Strong8'); await page.getByRole('button', { name: '로그인', exact: true }).click(); await expect(page.getByRole('button', { name: '내 클래스', exact: true })).toBeVisible(); }
    await page.goto(`http://127.0.0.1:5175/${role === 'teacher' ? 'admin' : role === 'board' ? 'live' : ''}?s=${sid}`);
    pages.push({ role, page });
  }
  const teacher = pages[0].page, board = pages[1].page, student = pages[2].page;
  await student.getByPlaceholder('닉네임 입력').fill('참여친구'); await student.getByRole('button', { name: '참여하기', exact: true }).click();
  await student.getByRole('button', { name: /A/ }).first().click();
  await student.getByRole('button', { name: '학습자 설정' }).click(); await expect(student.getByText('알림음', { exact: true })).toHaveCount(0); await student.getByRole('button', { name: '설정 닫기' }).click();
  await db.ref(`sessions/${sid}`).update({ currentQuestion: 'quiz', 'questions/quiz/activatedAt': Date.now() });
  await expect(student.getByRole('button', { name: /A/ }).first()).toBeVisible(); await student.getByRole('button', { name: /A/ }).first().click();
  const uid = await student.evaluate(async () => (await import('/src/lib/auth-session.js')).auth.currentUser.uid);
  await expect.poll(async () => (await db.ref(`sessions/${sid}/questions/quiz/votes/${uid}`).get()).exists()).toBe(true);
  await teacher.getByRole('button', { name: '두구두구', exact: true }).click(); await expect(board.getByText('잠시 후, 정답을 공개합니다')).toBeVisible();
  await expect.poll(async () => (await db.ref(`sessions/${sid}/questions/quiz/awardedAt`).get()).exists(), { timeout: 12000 }).toBe(true);
  await expect(student.getByText('정답!', { exact: true })).toBeVisible();
  await db.ref(`sessions/${sid}`).update({ currentMode: 'randomPicker', currentQuestion: null });
  await teacher.getByRole('button', { name: '발표자 뽑기', exact: true }).last().click();
  await expect.poll(async () => (await db.ref(`sessions/${sid}/gameResult`).get()).exists(), { timeout: 15000 }).toBe(true);
  const created = await Promise.all(pages.map(async ({ role, page }) => ({ role, contexts: await page.evaluate(() => __audioCreated) })));
  created.forEach(value => expect(value.contexts).toBe(0)); expect(errors).toEqual([]);
  console.log(JSON.stringify({ result: 'PASS', flow: 'join→question-change→drumroll→quiz-result→picker-result', audio: created, errors }));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); await db.ref(`sessions/${sid}`).remove(); await deleteApp(app); process.exit(process.exitCode || 0); });
