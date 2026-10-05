// Exercise the real ten-second timers and UI, rather than shortening the clock in fixtures.
if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('Local demo emulators required');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { chromium, expect } = require('@playwright/test');
const deps = createRequire(path.resolve(__dirname, '../../functions/package.json'));
const { initializeApp, deleteApp } = deps('firebase-admin/app');
const { getDatabase } = deps('firebase-admin/database');
const app = initializeApp({ projectId: 'demo-dorandoran', databaseURL: 'https://demo-dorandoran.firebaseio.com' }, 'speed-ui-qa');
const db = getDatabase(app), sid = 'qa_speed_ui_pipeline', base = 'http://127.0.0.1:5175';
const directory = path.join('/tmp', 'dorandoran-speed-quiz-' + process.pid);
fs.mkdirSync(directory, { recursive: true });
let browser, teacher, board;
const errors = [], evidence = [];
async function capture(page, key) {
  await page.waitForTimeout(650);
  await page.screenshot({ path: path.join(directory, key + '.png') });
  evidence.push({ key, file: key + '.png' });
}
(async () => {
  const questions = {
    first: { type: 'quiz', title: '첫 번째 자동 진행', options: ['첫 정답', '첫 오답'], correctAnswer: '첫 정답', order: 1, points: 100, maxSpeedBonus: 0, betting: false },
    second: { type: 'quiz', title: '두 번째 자동 진행', options: ['둘째 정답', '둘째 오답'], correctAnswer: '둘째 정답', order: 2, points: 100, maxSpeedBonus: 0, betting: false },
    third: { type: 'quiz', title: '세 번째 연속 정답 보너스', options: ['셋째 정답', '셋째 오답'], correctAnswer: '셋째 정답', order: 3, points: 100, maxSpeedBonus: 0, betting: false },
  };
  const fields = require('../../functions/public-question-fields.json');
  await db.ref(`sessions/${sid}`).set({ creatorId: 'legacy_master', courseId: 'course_a', courseName: '자동 진행 QA', status: 'active', currentMode: 'waiting', createdAt: Date.now(), questions,
    publicQuestions: Object.fromEntries(Object.entries(questions).map(([id, q]) => [id, Object.fromEntries(fields.filter(key => q[key] != null).map(key => [key, q[key]]))])) });
  browser = await chromium.launch(process.platform === 'darwin' ? { channel: 'chrome' } : {});
  teacher = await (await browser.newContext({ viewport: { width: 1512, height: 982 } })).newPage();
  board = await (await browser.newContext({ viewport: { width: 1512, height: 982 } })).newPage();
  const student = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  for (const page of [teacher, board, student]) page.on('pageerror', error => errors.push(error.message));
  await teacher.goto(base + '/admin');
  await teacher.getByPlaceholder('아이디').fill('qa-master');
  await teacher.getByPlaceholder('비밀번호').fill('TestFixture-Only-Strong8');
  await teacher.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(teacher.getByRole('button', { name: '내 클래스', exact: true })).toBeVisible();
  await teacher.goto(base + '/admin?s=' + sid);
  await board.goto(base + '/live?s=' + sid);
  await student.goto(base + '/?s=' + sid);
  await student.getByPlaceholder('닉네임 입력').fill('자동진행QA');
  await student.getByRole('button', { name: '참여하기', exact: true }).click();
  await expect(student.getByRole('button', { name: '학습자 설정' })).toBeVisible();
  const uid = await student.evaluate(async () => { const { ensureAuthentication } = await import('/src/lib/auth-session.js'); return (await ensureAuthentication()).uid; });
  await teacher.getByText('다음 퀴즈 이벤트 (선택)', { exact: true }).click();
  await teacher.getByRole('button', { name: '2배 점수', exact: true }).click();
  await expect.poll(async () => (await db.ref(`sessions/${sid}/pendingEvent/id`).get()).val()).toBe('double-points');
  await teacher.getByText('스피드 퀴즈 (선택)', { exact: true }).click();
  await teacher.getByRole('button', { name: /스피드 퀴즈.*3문제/ }).click();
  for (const [index, id, answer, total] of [[1, 'first', '첫 정답', 200], [2, 'second', '둘째 정답', 300], [3, 'third', '셋째 정답', 420]]) {
    await expect(student.getByRole('button', { name: new RegExp(answer) })).toBeVisible({ timeout: 20_000 });
    await student.getByRole('button', { name: new RegExp(answer) }).click();
    await expect.poll(async () => (await db.ref(`sessions/${sid}/questions/${id}/votes/${uid}`).get()).exists()).toBe(true);
    await expect.poll(async () => (await db.ref(`sessions/${sid}/questions/${id}/awardedAt`).get()).exists(), { timeout: 20_000 }).toBe(true);
    await expect.poll(async () => (await db.ref(`sessions/${sid}/scores/${uid}/total`).get()).val()).toBe(total);
    expect((await db.ref(`sessions/${sid}/pendingEvent`).get()).exists()).toBe(false);
    expect((await db.ref(`sessions/${sid}/questions/${id}/event/id`).get()).val()).toBe(id === 'first' ? 'double-points' : null);
    if (id === 'third') {
      await expect(student.getByText('+120점', { exact: true })).toBeVisible();
      await capture(student, '3-student-combo-120');
    }
    await capture(board, `${index}-board-auto-reveal`);
  }
  await expect.poll(async () => (await db.ref(`sessions/${sid}/currentMode`).get()).val(), { timeout: 10_000 }).toBe('leaderboard');
  await capture(board, '4-board-auto-leaderboard');
  await expect.poll(async () => (await db.ref(`sessions/${sid}/speedQuiz`).get()).exists(), { timeout: 10_000 }).toBe(false);
  const score = (await db.ref(`sessions/${sid}/scores/${uid}`).get()).val();
  expect(score.streak).toBe(3);
  expect(Object.keys(score.quizAwards)).toHaveLength(3);
  // Review after speedQuiz is cleared must retain the awarded combo receipt.
  await teacher.getByRole('button', { name: '발표 모드', exact: true }).click();
  await teacher.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await db.ref(`sessions/${sid}/currentQuestion`).get()).val()).toBe('second');
  await teacher.keyboard.press('ArrowRight');
  await expect.poll(async () => (await db.ref(`sessions/${sid}/currentQuestion`).get()).val()).toBe('third');
  await expect(student.getByText('+120점', { exact: true })).toBeVisible();
  expect((await db.ref(`sessions/${sid}/scores/${uid}/total`).get()).val()).toBe(420);
  await capture(student, '5-student-combo-review');
  expect(errors).toEqual([]);
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ result: 'PASS', evidence, errors, total: score.total }, null, 2));
  console.log('PASS actual 10-second speed quiz: one-shot event selected in UI -> 200/300/420 points (third +120 combo) -> leaderboard -> stopped -> receipt review; pageerror0');
})().catch(async error => { console.error(error); console.error(JSON.stringify((await db.ref(`sessions/${sid}`).get()).val())); await teacher?.screenshot({ path: path.join(directory, 'failure-teacher.png') }); await board?.screenshot({ path: path.join(directory, 'failure-board.png') }); process.exitCode = 1; }).finally(async () => {
  await browser?.close();
  await db.ref(`sessions/${sid}`).remove();
  await deleteApp(app);
});
