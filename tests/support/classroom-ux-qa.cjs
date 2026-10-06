const path = require('node:path');
const { chromium, expect } = require('@playwright/test');

if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000'
  || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') {
  throw new Error('Classroom UX regression requires local demo Auth/Database emulators.');
}
const dep = require('node:module').createRequire(path.resolve(__dirname, '../../functions/package.json'));
const { initializeApp, deleteApp } = dep('firebase-admin/app');
const { getDatabase } = dep('firebase-admin/database');
const { getAuth } = dep('firebase-admin/auth');
const app = initializeApp({ projectId: 'demo-dorandoran', databaseURL: 'https://demo-dorandoran.firebaseio.com' });
const db = getDatabase(app);
const sid = `qa_ux_regression_${process.pid}`;
const sessionRef = db.ref(`sessions/${sid}`);
const base = 'http://127.0.0.1:5175';
const errors = [], modelRequests = [], checks = [];
let browser, learnerUid;

async function checked(name, work) {
  await work();
  checks.push(name);
}

async function modalKeyboard(page, trigger, dialog, { open = true } = {}) {
  if (open) await trigger.click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  // Allow delayed input autofocus and the sheet entrance to finish before
  // testing actual Tab boundaries, including a disabled send button.
  await page.waitForTimeout(300);
  await dialog.evaluate(element => {
    const controls = [...element.querySelectorAll('a[href],button,input,textarea,select,[tabindex]')]
      .filter(control => !control.matches(':disabled') && control.tabIndex >= 0
        && !control.closest('[hidden],[inert]') && control.getClientRects().length);
    if (!controls.length) throw new Error('Dialog has no usable controls');
    window.__uxFirst = controls[0];
    window.__uxLast = controls.at(-1);
    controls[0].focus();
  });
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => document.activeElement === window.__uxLast)).toBe(true);
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement === window.__uxFirst)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  expect(await trigger.evaluate(element => document.activeElement === element)).toBe(true);
}

async function createForm(teacher, type, title) {
  await teacher.getByRole('button', { name: '문항 추가', exact: true }).click();
  await teacher.getByRole('button', { name: type, exact: true }).click();
  await teacher.getByRole('textbox', { name: '질문 내용', exact: true }).fill(title);
}

async function questionNamed(title) {
  return Object.entries((await sessionRef.child('questions').get()).val() || {})
    .find(([, question]) => question.title === title);
}

(async () => {
  const started = Date.now();
  try {
    const intro = { type: 'choice', title: '준비됐나요?', options: ['준비됐어요', '잠시만요'], order: 0 };
    await sessionRef.set({
      creatorId: 'legacy_master', courseId: 'course_a', courseName: '독립 UX 회귀',
      createdAt: Date.now(), startedAt: Date.now(), status: 'active', aiEnabled: false,
      currentMode: 'poll', currentQuestion: 'intro', questions: { intro }, publicQuestions: { intro },
      scores: { fixture: { nickname: '예시', total: 1 } },
    });
    browser = await chromium.launch(process.platform === 'darwin' ? { channel: 'chrome' } : {});
    const instructor = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const mobile = await browser.newContext({ viewport: { width: 320, height: 844 }, isMobile: true, hasTouch: true });
    for (const context of [instructor, mobile]) {
      await context.route('**/api/gemini/**', route => {
        if (new URL(route.request().url()).pathname.endsWith('/status')) return route.continue();
        modelRequests.push(new URL(route.request().url()).pathname);
        return route.abort();
      });
      await context.route('**/generativelanguage.googleapis.com/**', route => {
        modelRequests.push(new URL(route.request().url()).pathname);
        return route.abort();
      });
    }
    const teacher = await instructor.newPage(), student = await mobile.newPage();
    for (const page of [teacher, student]) {
      page.setDefaultTimeout(10000);
      page.on('pageerror', error => errors.push(error.message));
    }
    await teacher.goto(`${base}/admin?s=${sid}`);
    await teacher.getByPlaceholder('아이디').fill('qa-master');
    await teacher.getByPlaceholder('비밀번호').fill('TestFixture-Only-Strong8');
    await teacher.getByRole('button', { name: '로그인', exact: true }).click();
    await expect(teacher.getByRole('button', { name: '발표 모드', exact: true })).toBeVisible();

    await checked('768px mode menu scroll and Escape focus', async () => {
      await teacher.locator('summary').filter({ hasText: '수업 도구' }).click();
      const trigger = teacher.getByRole('button', { name: '모드', exact: true });
      await trigger.click();
      const region = teacher.getByRole('region', { name: '수업 화면 선택', exact: true });
      const last = region.getByRole('button', { name: '쉬는 시간', exact: true });
      await last.scrollIntoViewIfNeeded();
      const box = await last.boundingBox();
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(769);
      await teacher.keyboard.press('Escape');
      await expect(region).not.toBeVisible();
      expect(await trigger.evaluate(element => document.activeElement === element)).toBe(true);
    });

    const pollTitle = '실습과 토론 중 무엇을 더 좋아하나요?';
    await checked('opinion poll saves without a manufactured answer key', async () => {
      await createForm(teacher, '객관식', pollTitle);
      await teacher.getByRole('textbox', { name: '선택지 A', exact: true }).fill('실습');
      await teacher.getByRole('textbox', { name: '선택지 B', exact: true }).fill('토론');
      // Clear a previously chosen key, rather than only exercising the default
      // empty state. The stored poll must not acquire an arbitrary first answer.
      await teacher.getByRole('button', { name: /^A\s*실습$/ }).click();
      await teacher.getByRole('button', { name: '정답 없음 · 의견 투표', exact: true }).click();
      await teacher.getByRole('button', { name: '추가하기', exact: true }).click();
      await expect.poll(() => questionNamed(pollTitle)).toBeTruthy();
      expect((await questionNamed(pollTitle))[1].correctAnswer).toBeUndefined();
    });
    await checked('quiz still requires an answer key', async () => {
      const title = '정답이 필요한 퀴즈';
      await createForm(teacher, '퀴즈', title);
      await teacher.getByRole('textbox', { name: '선택지 A', exact: true }).fill('A');
      await teacher.getByRole('textbox', { name: '선택지 B', exact: true }).fill('B');
      await teacher.getByRole('button', { name: '추가하기', exact: true }).click();
      await expect(teacher.getByRole('alert')).toContainText('정답을 선택해주세요');
      expect(await questionNamed(title)).toBeUndefined();
      await teacher.getByRole('button', { name: '취소', exact: true }).last().click();
    });
    await checked('unconnected subjective activity saves without AI rubric', async () => {
      const title = '오늘 기억에 남는 점을 적어주세요';
      await createForm(teacher, '주관식', title);
      await expect(teacher.getByRole('textbox', { name: '모범답안', exact: true })).toHaveCount(0);
      await teacher.getByRole('button', { name: '추가하기', exact: true }).click();
      await expect.poll(() => questionNamed(title)).toBeTruthy();
      expect((await questionNamed(title))[1].modelAnswer).toBeUndefined();
    });

    const [pollId] = await questionNamed(pollTitle);
    await sessionRef.update({ currentMode: 'poll', currentQuestion: pollId });
    await student.goto(`${base}/?s=${sid}`);
    await student.getByPlaceholder('닉네임 입력').fill('회귀학생');
    await student.getByRole('button', { name: '참여하기', exact: true }).click();
    await expect(student.getByRole('heading', { name: pollTitle, exact: true })).toBeVisible();
    learnerUid = await student.evaluate(async () => {
      const { auth } = await import('/src/lib/auth-session.js');
      if (!auth.currentUser?.isAnonymous) throw new Error('Fresh anonymous learner required');
      return auth.currentUser.uid;
    });

    await checked('320px settings keyboard boundaries', async () => {
      await modalKeyboard(student, student.getByRole('button', { name: '학습자 설정', exact: true }),
        student.getByRole('dialog', { name: '학습자 설정', exact: true }));
    });
    await checked('320px chat keyboard boundaries including disabled send', async () => {
      const more = student.getByRole('button', { name: '참여 도구 더보기', exact: true });
      await more.click();
      await student.getByRole('button', { name: /^채팅/ }).click();
      const dialog = student.getByRole('dialog', { name: '전체 채팅', exact: true });
      // Chat is launched by a disappearing menu item; restoration must reach the
      // persistent toolbar trigger rather than body or the detached menu item.
      await modalKeyboard(student, more, dialog, { open: false });
    });
    await checked('320px question keyboard boundaries', async () => {
      await modalKeyboard(student, student.getByRole('button', { name: '수업 질문', exact: true }),
        student.getByRole('dialog', { name: '수업 질문', exact: true }));
    });
    await checked('opinion response acknowledged and persisted', async () => {
      await student.getByRole('button', { name: /실습/ }).click();
      await expect(student.getByText('내 응답', { exact: true })).toBeVisible();
      await expect.poll(async () => (await sessionRef.child(`questions/${pollId}/votes/${learnerUid}/value`).get()).val()).toBe('실습');
      await expect(student.getByText('전체 선택 비율 · 실시간', { exact: true })).toBeVisible();
    });
    await checked('offline snapshot label and queued response acknowledge on reconnect', async () => {
      await student.evaluate(async () => {
        const { db } = await import('/src/lib/firebase.js');
        const { goOffline } = await import('/node_modules/.vite/deps/firebase_database.js');
        goOffline(db);
      });
      await expect(student.getByText('마지막 집계 · 연결 복구 대기', { exact: true })).toBeVisible();
      await expect(student.getByText('· 실시간', { exact: true })).toHaveCount(0);
      await expect(student.getByText('A. 실습', { exact: true })).toBeVisible();
      await student.getByRole('button', { name: '답 바꾸기', exact: true }).click();
      await student.getByRole('button', { name: /토론/ }).click();
      await expect(student.getByText('전송 중...', { exact: false }).first()).toBeVisible();
      expect((await sessionRef.child(`questions/${pollId}/votes/${learnerUid}/value`).get()).val()).toBe('실습');
      await student.evaluate(async () => {
        const { db } = await import('/src/lib/firebase.js');
        const { goOnline } = await import('/node_modules/.vite/deps/firebase_database.js');
        goOnline(db);
      });
      await expect(student.getByText('B. 토론', { exact: true })).toBeVisible();
      await expect(student.getByText('전체 선택 비율 · 실시간', { exact: true })).toBeVisible();
      await expect.poll(async () => (await sessionRef.child(`questions/${pollId}/votes/${learnerUid}/value`).get()).val()).toBe('토론');
    });
    for (const page of [teacher, student]) expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    expect(modelRequests).toEqual([]);
    await checked('offline discussion memo is queued once and allows another memo after ACK', async () => {
      await sessionRef.update({ currentMode: 'discussion', discussion: { topic: '함께 배운 내용', duration: 60, endTime: Date.now() + 60000 } });
      const memo = student.getByPlaceholder('토론 내용을 메모하세요...');
      await memo.fill('연결을 기다리는 메모');
      await student.evaluate(async () => {
        const { db } = await import('/src/lib/firebase.js');
        const { goOffline } = await import('/node_modules/.vite/deps/firebase_database.js');
        goOffline(db);
      });
      await student.getByRole('button', { name: '메모 제출' }).evaluate(button => { button.click(); button.click(); });
      await expect(student.getByRole('button', { name: '보내는 중...' })).toBeDisabled();
      expect((await sessionRef.child('discussion/memos').get()).exists()).toBe(false);
      await student.evaluate(async () => {
        const { db } = await import('/src/lib/firebase.js');
        const { goOnline } = await import('/node_modules/.vite/deps/firebase_database.js');
        goOnline(db);
      });
      await expect.poll(async () => Object.keys((await sessionRef.child('discussion/memos').get()).val() || {}).length).toBe(1);
      await expect(memo).toHaveValue('');
      await memo.fill('새로 보낸 다음 메모');
      await student.getByRole('button', { name: '메모 제출' }).click();
      await expect.poll(async () => Object.keys((await sessionRef.child('discussion/memos').get()).val() || {}).length).toBe(2);
    });
    expect(errors).toEqual([]);
    console.log(JSON.stringify({ result: 'PASS', checks, durationMs: Date.now() - started, errors, modelRequests }));
  } finally {
    if (browser) await browser.close();
    // Both resources were created by this run in guarded emulators. Existing
    // courses, sessions, teacher ids and accounts are never cleared or modified.
    try {
      await sessionRef.remove();
      if (learnerUid) await getAuth(app).deleteUser(learnerUid);
    } finally {
      await deleteApp(app);
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
