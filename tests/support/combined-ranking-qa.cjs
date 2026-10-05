if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('Local demo emulators required');
const fs = require('fs'), path = require('path');
const { chromium, expect } = require('@playwright/test');
const dep = require('node:module').createRequire(path.resolve(__dirname, '../../functions/package.json'));
const { initializeApp, deleteApp } = dep('firebase-admin/app');
const { getDatabase } = dep('firebase-admin/database');
const { getAuth } = dep('firebase-admin/auth');
const app = initializeApp({ projectId: 'demo-dorandoran', databaseURL: 'https://demo-dorandoran.firebaseio.com' }, `combined-${process.pid}`);
const db = getDatabase(app), sid = `qa_design_next_board_actual_${process.pid}`, base = 'http://127.0.0.1:5175';
const folder = path.join('/tmp', `dorandoran-combined-ranking-${process.pid}`); fs.mkdirSync(folder, { recursive: true });
const errors = [], checks = [], evidence = [], ownedUsers = new Set(); let browser;
const question = { type: 'quiz', title: '자료는 누구에게 공유해야 하나요?', options: ['필요한 사람', '모든 사람'], correctAnswer: '필요한 사람', points: 100, maxSpeedBonus: 0, order: 0, activatedAt: Date.now() };
async function capture(page, label) { await page.waitForTimeout(350); const file = label + '.png'; await page.screenshot({ path: path.join(folder, file) }); evidence.push({ file, text: await page.locator('body').innerText() }); }
async function expectNoScroll(page) { const delta = await page.evaluate(() => { let node = document.querySelector('.classroom-stage > div:last-child'); return node ? node.scrollHeight - node.clientHeight : 0; }); expect(delta).toBeLessThanOrEqual(1); }
(async () => {
  await db.ref(`sessions/${sid}`).set({ creatorId: 'legacy_master', courseId: 'course_a', courseName: '합산 랭킹 공개 검증', createdAt: Date.now(), status: 'active', currentMode: 'quiz', currentQuestion: 'quiz', aiEnabled: false,
    questions: { quiz: question }, publicQuestions: { quiz: { type: question.type, title: question.title, options: question.options, points: 100, order: 0, activatedAt: question.activatedAt } } });
  browser = await chromium.launch(process.platform === 'darwin' ? { channel: 'chrome' } : {});
  const teacherContext = await browser.newContext({ viewport: { width: 1366, height: 768 } }), teacher = await teacherContext.newPage();
  teacher.on('pageerror', error => errors.push(error.message)); await teacher.goto(base + '/admin');
  await teacher.getByPlaceholder('아이디').fill('qa-master'); await teacher.getByPlaceholder('비밀번호').fill('TestFixture-Only-Strong8');
  await teacher.getByRole('button', { name: '로그인', exact: true }).click(); await expect(teacher.getByRole('button', { name: '내 클래스', exact: true })).toBeVisible();
  await teacher.goto(base + '/admin?s=' + sid); await expect(teacher.getByRole('button', { name: '발표 모드', exact: true })).toBeVisible();
  const teacherBoard = await teacherContext.newPage(), guestContext = await browser.newContext({ viewport: { width: 1366, height: 768 } }), board = await guestContext.newPage();
  for (const page of [teacherBoard, board]) { page.on('pageerror', error => errors.push(error.message)); await page.goto(base + '/live?s=' + sid); }
  const guestId = await board.evaluate(async () => { const { ensureAuthentication } = await import('/src/lib/auth-session.js'); return (await ensureAuthentication()).uid; }); ownedUsers.add(guestId);
  const learners = [];
  for (const [index, nickname] of ['집계하늘', '집계도윤', '집계서연'].entries()) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message)); await page.goto(base + '/?s=' + sid); await page.getByPlaceholder('닉네임 입력').fill(nickname);
    await page.getByRole('button', { name: '참여하기', exact: true }).click(); await expect(page.getByRole('button', { name: '학습자 설정' })).toBeVisible();
    const uid = await page.evaluate(async () => { const { ensureAuthentication } = await import('/src/lib/auth-session.js'); return (await ensureAuthentication()).uid; }); ownedUsers.add(uid);
    const value = index === 1 ? '모든 사람' : '필요한 사람'; await page.getByRole('button', { name: new RegExp(value) }).click();
    await expect.poll(async () => (await db.ref(`sessions/${sid}/questions/quiz/votes/${uid}`).get()).val()?.value).toBe(value);
    learners.push({ page, uid });
  }
  const denied = await learners[0].page.evaluate(async ({ sid, other }) => { const { db } = await import('/src/lib/firebase.js'); const { get, ref } = await import('/node_modules/.vite/deps/firebase_database.js');
    try { await get(ref(db, `sessions/${sid}/questions/quiz/votes/${other}`)); return false; } catch (error) { return /permission/i.test(error.message); } }, { sid, other: learners[1].uid });
  expect(denied).toBe(true); checks.push('Before reveal, another learner vote is denied');
  const metadataBefore = (await db.ref(`sessions/${sid}/publicQuestions/quiz`).get()).val(); expect(metadataBefore.votes).toBeUndefined(); expect(metadataBefore.correctAnswer).toBeUndefined();
  await teacher.getByRole('button', { name: '발표 모드', exact: true }).click(); await teacher.getByRole('button', { name: '정답 공개', exact: true }).click();
  await expect.poll(async () => (await db.ref(`sessions/${sid}/questions/quiz/awardedAt`).get()).exists()).toBe(true);
  await expect.poll(async () => (await db.ref(`sessions/${sid}/publicQuestions/quiz/correctAnswer`).get()).val()).toBe('필요한 사람');
  await teacher.keyboard.press('Escape'); await db.ref(`sessions/${sid}`).update({ currentMode: 'combinedRanking', currentQuestion: null });
  for (const page of [teacherBoard, board]) {
    await expect(page.getByRole('heading', { name: '합산 랭킹', exact: true })).toBeVisible(); await expect(page.getByText('공개 문항 1개 · 응답 3명', { exact: true })).toBeVisible();
    await expect(page.locator('.combined-ranking-list > li')).toHaveCount(2); await expect(page.getByText('집계하늘', { exact: true })).toBeVisible(); await expect(page.getByText('집계서연', { exact: true })).toBeVisible();
  }
  expect(await teacherBoard.locator('.combined-ranking-list').innerText()).toBe(await board.locator('.combined-ranking-list').innerText());
  const publicMeta = (await db.ref(`sessions/${sid}/publicQuestions/quiz`).get()).val(); expect(publicMeta.votes).toBeUndefined(); checks.push('3 actual learner ACKs; reveal through instructor UI; guest metadata has no votes; both rankings match; wrong-only learner counted in responses but excluded from positive-correct ranking');
  await capture(board, '01-guest-real-ranking'); await capture(teacherBoard, '02-staff-real-ranking');
  const long = '팀원들과 목표를 먼저 확인하고 작은 실습부터 시작하겠습니다. 결과를 함께 검토하면서 반복되는 작업을 조금씩 개선하고 싶습니다. '.repeat(6).slice(0, 380);
  const values = { long: { type: 'subjective', title: '실무 적용 계획을 남겨주세요', votes: { [learners[0].uid]: { nickname: '집계하늘', value: long, timestamp: Date.now() } } },
    short: { type: 'shortAnswer', title: '함께 일할 때 중요한 것은 무엇인가요?', correctAnswer: '소통', revealedAt: Date.now(), votes: Object.fromEntries(learners.map((learner, index) => [learner.uid, { nickname: ['집계하늘', '집계도윤', '집계서연'][index], value: index === 1 ? '신뢰' : '소통', timestamp: Date.now() + index }])) },
    hint: { type: 'hintQuiz', title: '힌트를 보고 핵심 단어를 맞혀주세요', correctAnswer: '협업', revealedAt: Date.now(), hints: ['함께할 때 더 잘할 수 있어요'], revealedHints: 1, votes: {} },
    check: { type: 'check', title: '실습을 마쳤다면 완료를 눌러주세요', votes: {} },
    rank: { type: 'ranking', title: '프로젝트 진행 순서를 맞춰주세요', options: ['문제 이해', '아이디어', '시제품', '피드백'], correctAnswer: '0,1,2,3', revealedAt: Date.now(), votes: {} } };
  for (const [id, q] of Object.entries(values)) {
    q.order = 1; const fields = require('../../functions/public-question-fields.json'); const view = Object.fromEntries(fields.filter(key => q[key] !== undefined).map(key => [key, q[key]])); if (q.revealedAt) view.correctAnswer = q.correctAnswer;
    await db.ref(`sessions/${sid}`).update({ [`questions/${id}`]: q, [`publicQuestions/${id}`]: view, currentMode: 'poll', currentQuestion: id });
    await expect(board.getByRole('heading', { name: q.title, exact: true })).toBeVisible(); await board.waitForTimeout(600); await expectNoScroll(board); await capture(board, `fit-${id}-1366`);
  }
  expect(errors).toEqual([]); checks.push('1366x768 long380/short/hint/check/ranking stay within the display');
  console.log(JSON.stringify({ result: 'PASS', checks, errors, folder }));
})().catch(async error => { console.error(error); if (browser) for (const context of browser.contexts()) for (const page of context.pages()) { await page.screenshot({ path: path.join(folder, 'failure-' + Math.random().toString(36).slice(2) + '.png') }).catch(() => {}); } process.exitCode = 1; }).finally(async () => {
  fs.writeFileSync(path.join(folder, 'manifest.json'), JSON.stringify({ checks, errors, evidence }, null, 2));
  await browser?.close(); await db.ref(`sessions/${sid}`).remove(); await db.ref(`sessionViewers/${sid}`).remove();
  for (const uid of ownedUsers) await getAuth(app).deleteUser(uid).catch(() => {});
  await deleteApp(app);
});
