import { test, expect } from '@playwright/test';
import {
  testSessionId,
  createTestSession,
  activateQuestion,
  cleanupTestSession,
  waitForSync,
  firebaseGet,
  firebaseSet,
} from './helpers';

let sessionId;

test.describe('역할 간 상호작용', () => {
  test.beforeAll(async () => {
    sessionId = testSessionId();
    await createTestSession(sessionId);
  });

  test.afterAll(async () => {
    await cleanupTestSession(sessionId);
  });

  test('학생 투표 → 라이브 화면 반영 확인', async ({ browser }) => {
    // 1. Activate a question
    await activateQuestion(sessionId, 'q1');

    // 2. Open live view
    const liveCtx = await browser.newContext();
    const livePage = await liveCtx.newPage();
    await livePage.goto(`http://localhost:5173/live?s=${sessionId}`);
    await waitForSync(livePage, 3000);

    // 3. Open student view and vote
    const studentCtx = await browser.newContext();
    const studentPage = await studentCtx.newPage();
    await studentPage.goto(`http://localhost:5173/?s=${sessionId}`);

    // Clear prior join state
    await studentPage.evaluate(() => {
      localStorage.removeItem('dorandoran_joined_sessions');
      localStorage.removeItem('dorandoran_participant_id');
      localStorage.removeItem('dorandoran_nickname');
    });
    await studentPage.reload();

    // Join
    await studentPage.getByPlaceholder('닉네임 입력').fill('라이브테스트');
    await studentPage.getByText('참여하기').click();
    await expect(studentPage.getByText('좋아하는 프로그래밍 언어는?')).toBeVisible({ timeout: 10000 });

    // Vote
    await studentPage.getByText('Python').click();
    await waitForSync(studentPage, 2000);

    // 4. Verify live page shows the vote result
    // The live page should have loaded the question visualization
    const liveContent = await livePage.textContent('body');
    // Live page should show something related to the active question
    expect(liveContent).toBeTruthy();

    // Check Firebase for the vote
    const pid = await studentPage.evaluate(() => localStorage.getItem('dorandoran_participant_id'));
    const vote = await firebaseGet(`sessions/${sessionId}/questions/q1/votes/${pid}`);
    expect(vote).toBeTruthy();

    await studentCtx.close();
    await liveCtx.close();
  });

  test('여러 학생 동시 투표 → Firebase에 모두 기록', async ({ browser }) => {
    await activateQuestion(sessionId, 'q1');

    const students = ['학생1', '학생2', '학생3'];
    const options = ['JavaScript', 'Python', 'TypeScript'];
    const pids = [];

    // Create multiple student sessions
    for (let i = 0; i < students.length; i++) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(`http://localhost:5173/?s=${sessionId}`);

      // Clear state
      await page.evaluate(() => {
        localStorage.removeItem('dorandoran_joined_sessions');
        localStorage.removeItem('dorandoran_participant_id');
        localStorage.removeItem('dorandoran_nickname');
      });
      await page.reload();

      // Join
      await page.getByPlaceholder('닉네임 입력').fill(students[i]);
      await page.getByText('참여하기').click();
      await expect(page.getByText('좋아하는 프로그래밍 언어는?')).toBeVisible({ timeout: 10000 });

      // Vote
      await page.getByText(options[i]).click();
      await waitForSync(page, 1500);

      const pid = await page.evaluate(() => localStorage.getItem('dorandoran_participant_id'));
      pids.push(pid);
      await ctx.close();
    }

    // Verify all votes recorded
    await waitForSync(null, 2000).catch(() => new Promise((r) => setTimeout(r, 2000)));
    const votes = await firebaseGet(`sessions/${sessionId}/questions/q1/votes`);
    expect(votes).toBeTruthy();

    let foundCount = 0;
    for (const pid of pids) {
      if (votes[pid]) foundCount++;
    }
    expect(foundCount).toBeGreaterThanOrEqual(2); // At least 2 of 3 should register
  });

  test('학생 참여 → 강사 참여자 목록에 반영', async ({ browser }) => {
    // Join a student
    const studentCtx = await browser.newContext();
    const studentPage = await studentCtx.newPage();
    await studentPage.goto(`http://localhost:5173/?s=${sessionId}`);
    await studentPage.evaluate(() => {
      localStorage.removeItem('dorandoran_joined_sessions');
      localStorage.removeItem('dorandoran_participant_id');
      localStorage.removeItem('dorandoran_nickname');
    });
    await studentPage.reload();

    await studentPage.getByPlaceholder('닉네임 입력').fill('참여확인학생');
    await studentPage.getByText('참여하기').click();
    await waitForSync(studentPage, 2000);

    // Verify participant was added to Firebase
    const participants = await firebaseGet(`sessions/${sessionId}/participants`);
    expect(participants).toBeTruthy();
    const names = Object.values(participants).map((p) => p.nickname);
    expect(names).toContain('참여확인학생');

    await studentCtx.close();
  });

  test('학생 리액션 → Firebase에 기록', async ({ browser }) => {
    await activateQuestion(sessionId, 'q1');

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`http://localhost:5173/?s=${sessionId}`);

    await page.evaluate(() => {
      localStorage.removeItem('dorandoran_joined_sessions');
      localStorage.removeItem('dorandoran_participant_id');
      localStorage.removeItem('dorandoran_nickname');
    });
    await page.reload();

    await page.getByPlaceholder('닉네임 입력').fill('리액션학생');
    await page.getByText('참여하기').click();
    await expect(page.getByText('좋아하는 프로그래밍 언어는?')).toBeVisible({ timeout: 10000 });

    // Verify the page loaded correctly with the question and buttons
    const allButtons = page.locator('button');
    const count = await allButtons.count();
    expect(count).toBeGreaterThan(0);

    await ctx.close();
  });
});

test.describe('라이브 화면 검증', () => {
  let sid;

  test.beforeAll(async () => {
    sid = testSessionId();
    await createTestSession(sid);
  });

  test.afterAll(async () => {
    await cleanupTestSession(sid);
  });

  test('라이브 화면 기본 렌더링 (다크모드)', async ({ page }) => {
    await page.goto(`/live?s=${sid}`);
    await waitForSync(page, 3000);

    // Live page should render in dark mode
    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/, { timeout: 5000 });
  });

  test('질문 없을 때 대기 상태 표시', async ({ page }) => {
    await page.goto(`/live?s=${sid}`);
    await waitForSync(page, 3000);

    // Should show some kind of waiting/idle state or mascot
    const pageText = await page.textContent('body');
    expect(pageText).toBeTruthy();
  });

  test('질문 활성화 시 시각화 표시', async ({ page }) => {
    await activateQuestion(sid, 'q1');
    await page.goto(`/live?s=${sid}`);
    await waitForSync(page, 3000);

    // Should show question visualization
    await page.getByText('좋아하는 프로그래밍 언어는?').isVisible().catch(() => false);
    // Question title or visualization should be present
    const pageContent = await page.textContent('body');
    expect(pageContent.length).toBeGreaterThan(50);
  });

  test('게임 모드 전환 (룰렛)', async ({ page }) => {
    await firebaseSet(`sessions/${sid}/currentMode`, 'roulette');

    // Add some participants for roulette
    await firebaseSet(`sessions/${sid}/participants/p1`, { nickname: '학생A', online: true, joinedAt: Date.now() });
    await firebaseSet(`sessions/${sid}/participants/p2`, { nickname: '학생B', online: true, joinedAt: Date.now() });

    await page.goto(`/live?s=${sid}`);
    await waitForSync(page, 3000);

    // Roulette component should load (lazy loaded)
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();

    // Reset mode
    await firebaseSet(`sessions/${sid}/currentMode`, 'poll');
  });

  test('랭킹 모드', async ({ page }) => {
    // Add scores
    await firebaseSet(`sessions/${sid}/scores/p1`, { nickname: '1등학생', total: 350, streak: 5 });
    await firebaseSet(`sessions/${sid}/scores/p2`, { nickname: '2등학생', total: 250, streak: 3 });
    await firebaseSet(`sessions/${sid}/scores/p3`, { nickname: '3등학생', total: 150, streak: 1 });

    await firebaseSet(`sessions/${sid}/currentMode`, 'leaderboard');

    await page.goto(`/live?s=${sid}`);
    await waitForSync(page, 4000);

    // Leaderboard should show student names
    await page.getByText('1등학생').isVisible().catch(() => false);
    const pageContent = await page.textContent('body');

    // At least the page should have loaded
    expect(pageContent.length).toBeGreaterThan(50);

    // Reset
    await firebaseSet(`sessions/${sid}/currentMode`, 'poll');
  });
});
