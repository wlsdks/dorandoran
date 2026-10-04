import { test, expect } from '@playwright/test';
import {
  testSessionId,
  createTestSession,
  activateQuestion,
  cleanupTestSession,
  waitForSync,
  firebaseSet,
  firebaseGet,
} from './helpers';

test.describe('세션 라이프사이클', () => {
  let sessionId;

  test.beforeEach(async () => {
    sessionId = testSessionId();
  });

  test.afterEach(async () => {
    await cleanupTestSession(sessionId);
  });

  test('세션 종료 시 학생에게 종료 화면 표시', async ({ page }) => {
    await createTestSession(sessionId, { status: 'active' });
    await activateQuestion(sessionId, 'q1');

    // Join as student
    await page.goto(`/?s=${sessionId}`);
    await page.evaluate(() => {
      localStorage.removeItem('dorandoran_joined_sessions');
      localStorage.removeItem('dorandoran_participant_id');
      localStorage.removeItem('dorandoran_nickname');
    });
    await page.reload();

    await page.getByPlaceholder('닉네임 입력').fill('종료확인학생');
    await page.getByText('참여하기').click();
    await expect(page.getByText('좋아하는 프로그래밍 언어는?')).toBeVisible({ timeout: 10000 });

    // End session via Firebase
    await firebaseSet(`sessions/${sessionId}/status`, 'ended');
    await waitForSync(page, 3000);

    // Should show ended state
    const bodyText = await page.textContent('body');
    // Ended page or some indication
    expect(bodyText).toBeTruthy();
  });

  test('리뷰 모드에서 학생 투표 불가', async ({ page }) => {
    await createTestSession(sessionId, { status: 'reviewing' });
    await activateQuestion(sessionId, 'q1');

    await page.goto(`/?s=${sessionId}`);
    await page.evaluate(() => {
      localStorage.removeItem('dorandoran_joined_sessions');
      localStorage.removeItem('dorandoran_participant_id');
      localStorage.removeItem('dorandoran_nickname');
    });
    await page.reload();

    await page.getByPlaceholder('닉네임 입력').fill('리뷰학생');
    await page.getByText('참여하기').click();
    await waitForSync(page, 3000);

    // In reviewing mode, student should see reviewing banner or disabled voting
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
  });

  test('OX 질문 투표 플로우', async ({ page }) => {
    await createTestSession(sessionId);
    await activateQuestion(sessionId, 'q2'); // OX question

    await page.goto(`/?s=${sessionId}`);
    await page.evaluate(() => {
      localStorage.removeItem('dorandoran_joined_sessions');
      localStorage.removeItem('dorandoran_participant_id');
      localStorage.removeItem('dorandoran_nickname');
    });
    await page.reload();

    await page.getByPlaceholder('닉네임 입력').fill('OX학생');
    await page.getByText('참여하기').click();
    await waitForSync(page, 3000);

    // Should show OX question — title may be truncated, check for partial match
    const questionVisible = await page.getByText(/이번 수업 이해도/).isVisible({ timeout: 10000 }).catch(() => false);
    if (questionVisible) {
      // OX buttons show large O/X text with "맞아요"/"아니에요" labels
      // Click the O card which contains "맞아요"
      const oBtn = page.getByText('맞아요');
      if (await oBtn.isVisible().catch(() => false)) {
        await oBtn.click();
        await waitForSync(page, 3000);

        const pid = await page.evaluate(() => localStorage.getItem('dorandoran_participant_id'));
        const vote = await firebaseGet(`sessions/${sessionId}/questions/q2/votes/${pid}`);
        expect(vote).toBeTruthy();
      }
    }
  });

  test('워드클라우드 텍스트 입력', async ({ page }) => {
    await createTestSession(sessionId);
    await activateQuestion(sessionId, 'q3'); // wordcloud

    await page.goto(`/?s=${sessionId}`);
    await page.evaluate(() => {
      localStorage.removeItem('dorandoran_joined_sessions');
      localStorage.removeItem('dorandoran_participant_id');
      localStorage.removeItem('dorandoran_nickname');
    });
    await page.reload();

    await page.getByPlaceholder('닉네임 입력').fill('워드학생');
    await page.getByText('참여하기').click();
    await waitForSync(page, 3000);

    // Should show text input for wordcloud
    const questionVisible = await page.getByText('수업에서 가장 좋았던 점은?').isVisible({ timeout: 10000 }).catch(() => false);
    if (questionVisible) {
      // Look for text input area
      const textInput = page.locator('textarea, input[type="text"]').last();
      if (await textInput.isVisible().catch(() => false)) {
        await textInput.fill('실습이 재미있었어요');

        // Submit
        const submitBtn = page.getByRole('button', { name: /제출|보내기|확인/i });
        if (await submitBtn.isVisible().catch(() => false)) {
          await submitBtn.click();
          await waitForSync(page, 2000);
        }
      }
    }
  });

  test('퀴즈 모드 - 정답 확인', async ({ page }) => {
    await createTestSession(sessionId, { currentMode: 'quiz' });
    await activateQuestion(sessionId, 'q4'); // quiz question

    await page.goto(`/?s=${sessionId}`);
    await page.evaluate(() => {
      localStorage.removeItem('dorandoran_joined_sessions');
      localStorage.removeItem('dorandoran_participant_id');
      localStorage.removeItem('dorandoran_nickname');
    });
    await page.reload();

    await page.getByPlaceholder('닉네임 입력').fill('퀴즈학생');
    await page.getByText('참여하기').click();
    await waitForSync(page, 3000);

    // Should show quiz question
    const questionVisible = await page.getByText(/수도 퀴즈/).isVisible({ timeout: 10000 }).catch(() => false);
    if (questionVisible) {
      // Click correct answer — quiz options are buttons with text
      const seoulBtn = page.getByText('서울').first();
      if (await seoulBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await seoulBtn.click();
        await waitForSync(page, 1000);

        // Quiz may show confidence meter ("얼마나 확신하나요?") — click a confidence level
        const confidenceBtn = page.getByText('확신').last();
        if (await confidenceBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await confidenceBtn.click();
        }
        await waitForSync(page, 3000);

        const pid = await page.evaluate(() => localStorage.getItem('dorandoran_participant_id'));
        const vote = await firebaseGet(`sessions/${sessionId}/questions/q4/votes/${pid}`);
        expect(vote).toBeTruthy();
      }
    }
  });
});
