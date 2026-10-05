if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('Local demo emulators required');
const { chromium, expect } = require('@playwright/test');
const dep = require('node:module').createRequire(require('node:path').resolve(__dirname, '../../functions/package.json'));
const { initializeApp, deleteApp } = dep('firebase-admin/app');
const { getDatabase } = dep('firebase-admin/database');
const app = initializeApp({ projectId: 'demo-dorandoran', databaseURL: 'https://demo-dorandoran.firebaseio.com' }, 'judging-lifecycle-qa'), db = getDatabase(app);
const sid = 'qa_judging_lifecycle', aid = 'qa_assignment_lifecycle'; let browser;
const fakeModel = `export function isGeminiConfigured() { return true; }
export function getGeminiModel() { return { generateContent: async (_request, { signal } = {}) => {
  window.__fakeRequests = (window.__fakeRequests || 0) + 1;
  return new Promise((resolve, reject) => {
    const finish = () => { signal?.removeEventListener('abort', cancel); resolve({ response: { text: () => '{"score":8,"selected":true}' } }); };
    const timer = setTimeout(finish, 1500);
    const cancel = () => { clearTimeout(timer); window.__fakeAborts = (window.__fakeAborts || 0) + 1; reject(signal.reason); };
    signal?.addEventListener('abort', cancel, { once: true }); if (signal?.aborted) cancel();
  });
} }; }`;
(async () => {
  await db.ref(`sessions/${sid}`).set({ creatorId: 'legacy_master', createdAt: 1, status: 'active', questions: {
    q: { title: '취소 점검', type: 'aiJudge', submissions: { student: { name: '테스트학생', title: '실습', submittedAt: 1 } } },
    next: { title: '다음 과제', type: 'aiJudge' } } });
  await db.ref(`assignments/${aid}`).set({ ownerId: 'legacy_master', title: '취소 점검', hasJudging: true, status: 'open', submissions: { student: { name: '테스트학생', code: '<p>test</p>', submittedAt: 1 } } });
  browser = await chromium.launch(process.platform === 'darwin' ? { channel: 'chrome' } : {});
  const page = await browser.newPage(), errors = [];
  page.on('console', message => { if (message.type() === 'warning' || message.type() === 'error') console.log(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/src/lib/gemini/client.js*', route => route.fulfill({ contentType: 'application/javascript', body: fakeModel }));
  await page.goto('http://127.0.0.1:5175/admin'); await page.getByPlaceholder('아이디').fill('qa-master'); await page.getByPlaceholder('비밀번호').fill('TestFixture-Only-Strong8');
  await page.getByRole('button', { name: '로그인', exact: true }).click(); await expect(page.getByRole('button', { name: '내 클래스', exact: true })).toBeVisible();
  await page.evaluate(async props => { window.JudgingHarness = await import('/tests/support/JudgingLifecycleHarness.jsx'); JudgingHarness.renderProbe(props); }, { sessionId: sid, questionId: 'q', assignmentId: aid });
  await page.getByRole('button', { name: 'Start live', exact: true }).click(); await expect.poll(() => page.evaluate(() => window.__fakeRequests || 0)).toBe(1);
  await page.getByRole('button', { name: 'Reset live', exact: true }).click();
  await expect.poll(async () => (await db.ref(`sessions/${sid}/questions/q/aiJudgeState`).get()).exists()).toBe(false);
  await page.waitForTimeout(1700); expect((await db.ref(`sessions/${sid}/questions/q/aiResults`).get()).exists()).toBe(false);
  await page.getByRole('button', { name: 'Start assignment', exact: true }).click(); await expect.poll(() => page.evaluate(() => window.__fakeRequests || 0)).toBe(8);
  await page.getByRole('button', { name: 'Abort assignment', exact: true }).click();
  await expect.poll(async () => (await db.ref(`assignments/${aid}/status`).get()).val()).toBe('open');
  expect((await db.ref(`assignments/${aid}/results`).get()).exists()).toBe(false);
  await page.getByRole('button', { name: 'Start live', exact: true }).click(); await expect.poll(() => page.evaluate(() => window.__fakeRequests || 0)).toBe(9);
  await page.evaluate(props => JudgingHarness.renderProbe(props), { sessionId: sid, questionId: 'next', assignmentId: aid });
  await expect.poll(async () => (await db.ref(`sessions/${sid}/questions/q/aiJudgeState/status`).get()).val()).toBe('aborted');
  await page.waitForTimeout(1700); expect((await db.ref(`sessions/${sid}/questions/q/aiResults`).get()).exists()).toBe(false);
  await page.evaluate(() => JudgingHarness.destroyProbe());
  const abortedRequests = await page.evaluate(() => window.__fakeAborts); expect(abortedRequests).toBe(9); expect(errors).toEqual([]);
  console.log(JSON.stringify({ result: 'PASS', cases: ['reset drains in-flight work', 'cancel restores assignment status', 'question switch cancels old run'], abortedRequests, realModelCalls: 0, errors }));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await browser?.close(); await db.ref(`sessions/${sid}`).remove(); await db.ref(`assignments/${aid}`).remove(); await deleteApp(app); process.exit(process.exitCode || 0);
});
