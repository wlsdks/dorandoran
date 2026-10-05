if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('Local demo emulators required');
const { chromium, expect } = require('@playwright/test');
const dep = require('node:module').createRequire(require('node:path').resolve(__dirname, '../../functions/package.json'));
const { initializeApp, deleteApp } = dep('firebase-admin/app'), { getDatabase } = dep('firebase-admin/database');
const app = initializeApp({ projectId: 'demo-dorandoran', databaseURL: 'https://demo-dorandoran.firebaseio.com' }, 'audience-qa'), db = getDatabase(app), sid = 'qa_staff_audience'; let browser;
(async () => {
  const q = { type: 'quiz', title: '같은 강사 계정의 관객 화면', options: ['A', 'B'], correctAnswer: 'B', points: 100,
    votes: { one: { value: 'A', nickname: '하늘', timestamp: 1 }, two: { value: 'B', nickname: '도윤', timestamp: 1 } }, order: 0 };
  const view = { q: { type: q.type, title: q.title, options: q.options, order: 0 } };
  await db.ref(`sessions/${sid}`).set({ creatorId: 'legacy_master', createdAt: 1, status: 'active', currentMode: 'poll', currentQuestion: 'q', questions: { q }, publicQuestions: view });
  browser = await chromium.launch(process.platform === 'darwin' ? { channel: 'chrome' } : {});
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } }), teacher = await context.newPage(), errors = [];
  teacher.on('pageerror', error => errors.push(error.message));
  await teacher.goto('http://127.0.0.1:5175/admin'); await teacher.getByPlaceholder('아이디').fill('qa-master'); await teacher.getByPlaceholder('비밀번호').fill('TestFixture-Only-Strong8');
  await teacher.getByRole('button', { name: '로그인', exact: true }).click(); await expect(teacher.getByRole('button', { name: '내 클래스', exact: true })).toBeVisible();
  const board = await context.newPage(); board.on('pageerror', error => errors.push(error.message));
  await board.goto(`http://127.0.0.1:5175/live?s=${sid}`);
  await expect(board.getByText('응답 집계는 정답 공개 후 표시됩니다', { exact: true })).toBeVisible();
  expect(await board.getByText('50%', { exact: true }).count()).toBe(0);
  // 승인된 강사의 같은 브라우저여도 관객 화면은 공개 뷰를 발행하지 않는다.
  await board.waitForTimeout(350); expect((await db.ref(`sessions/${sid}/publicQuestions`).get()).val()).toEqual(view);
  const at = Date.now(); await db.ref(`sessions/${sid}`).update({ 'questions/q/revealedAt': at, 'publicQuestions/q/revealedAt': at, 'publicQuestions/q/correctAnswer': 'B' });
  await expect(board.getByText('50%', { exact: true })).toHaveCount(2); await expect(board.getByText(/^응답\s*2명$/)).toBeVisible();
  expect(errors).toEqual([]); console.log(JSON.stringify({ result: 'PASS', sameStaffContext: true, hiddenBeforeReveal: true, percentagesAfterReveal: [50, 50], boardWritesQuestionView: false, errors }));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); await db.ref(`sessions/${sid}`).remove(); await deleteApp(app); process.exit(process.exitCode || 0); });
