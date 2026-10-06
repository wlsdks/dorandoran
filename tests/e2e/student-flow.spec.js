import { test, expect } from '@playwright/test';
import {
  testSessionId,
  createTestSession,
  activateQuestion,
  cleanupTestSession,
  waitForSync,
  firebaseGet,
} from './helpers';

let sessionId;

test.describe('학생 플로우', () => {
  test.beforeAll(async () => {
    sessionId = testSessionId();
    await createTestSession(sessionId);
  });

  test.afterAll(async () => {
    await cleanupTestSession(sessionId);
  });

  test('세션 ID 없이 접속하면 강사 로그인으로 이동', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('도란도란')).toBeVisible();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByPlaceholder('아이디')).toBeVisible();
    await expect(page.getByPlaceholder('비밀번호')).toBeVisible();
  });

  test('세션 ID로 접속하면 JoinPage 표시 (닉네임 입력)', async ({ page }) => {
    await page.goto(`/?s=${sessionId}`);
    await expect(page.getByPlaceholder('닉네임 입력')).toBeVisible();
    await expect(page.getByText('E2E 테스트 수업').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /참여하기/ })).toBeVisible();
  });

  test('닉네임 2자 미만이면 참여 버튼 비활성화', async ({ page }) => {
    await page.goto(`/?s=${sessionId}`);
    const input = page.getByPlaceholder('닉네임 입력');
    await input.fill('가');
    await input.blur();
    await expect(page.getByText('2자 이상 입력해주세요')).toBeVisible();
    await expect(page.getByRole('button', { name: /참여하기/ })).toBeDisabled();
  });

  test('닉네임 입력 후 참여 → VotePage/WaitingPage 전환', async ({ page }) => {
    await page.goto(`/?s=${sessionId}`);

    // Clear any prior join state
    await page.evaluate(() => {
      localStorage.removeItem('dorandoran_joined_sessions');
      localStorage.removeItem('dorandoran_participant_id');
      localStorage.removeItem('dorandoran_nickname');
    });
    await page.reload();

    const input = page.getByPlaceholder('닉네임 입력');
    await input.fill('테스트학생');
    await expect(page.getByText('참여하기')).toBeEnabled();
    await page.getByText('참여하기').click();

    // Should transition to WaitingPage (no active question yet)
    await expect(page.getByText('테스트학생님, 준비됐어요!', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('질문 활성화 시 투표 화면으로 자동 전환', async ({ page }) => {
    // Join first
    await page.goto(`/?s=${sessionId}`);
    await page.evaluate(() => {
      localStorage.removeItem('dorandoran_joined_sessions');
      localStorage.removeItem('dorandoran_participant_id');
      localStorage.removeItem('dorandoran_nickname');
    });
    await page.reload();

    await page.getByPlaceholder('닉네임 입력').fill('학생A');
    await page.getByText('참여하기').click();
    await expect(page.getByText('학생A님, 준비됐어요!', { exact: true })).toBeVisible({ timeout: 10000 });

    // Activate question from Firebase
    await activateQuestion(sessionId, 'q1');
    await waitForSync(page, 3000);

    // Should show the choice question
    await expect(page.getByText('좋아하는 프로그래밍 언어는?')).toBeVisible({ timeout: 10000 });
  });

  test('객관식 투표 가능', async ({ page }) => {
    // Ensure question is active
    await activateQuestion(sessionId, 'q1');

    // Join
    await page.goto(`/?s=${sessionId}`);
    await page.evaluate(() => {
      localStorage.removeItem('dorandoran_joined_sessions');
      localStorage.removeItem('dorandoran_participant_id');
      localStorage.removeItem('dorandoran_nickname');
    });
    await page.reload();

    await page.getByPlaceholder('닉네임 입력').fill('투표학생');
    await page.getByText('참여하기').click();

    // Wait for question to appear
    await expect(page.getByText('좋아하는 프로그래밍 언어는?')).toBeVisible({ timeout: 10000 });

    // Click one of the options
    await page.getByText('JavaScript').click();

    // Should show confirmation or submitted state
    await waitForSync(page, 2000);

    // Verify vote was recorded in Firebase
    const pid = await page.evaluate(() => localStorage.getItem('dorandoran_participant_id'));
    const vote = await firebaseGet(`sessions/${sessionId}/questions/q1/votes/${pid}`);
    expect(vote).toBeTruthy();
  });

  test('손들기 토글 작동', async ({ page }) => {
    await activateQuestion(sessionId, 'q1');

    await page.goto(`/?s=${sessionId}`);
    await page.evaluate(() => {
      localStorage.removeItem('dorandoran_joined_sessions');
      localStorage.removeItem('dorandoran_participant_id');
      localStorage.removeItem('dorandoran_nickname');
    });
    await page.reload();

    await page.getByPlaceholder('닉네임 입력').fill('손들기학생');
    await page.getByText('참여하기').click();
    await expect(page.getByText('좋아하는 프로그래밍 언어는?')).toBeVisible({ timeout: 10000 });

    // Look for hand raise button in bottom bar
    const handBtn = page.getByRole('button', { name: /손들기/i });
    if (await handBtn.isVisible()) {
      await handBtn.click();
      await waitForSync(page, 1500);

      // Verify in Firebase
      const pid = await page.evaluate(() => localStorage.getItem('dorandoran_participant_id'));
      const handRaise = await firebaseGet(`sessions/${sessionId}/handRaises/${pid}`);
      expect(handRaise?.raised).toBe(true);
    }
  });

  test('익명 긴급 질문 전송', async ({ page }) => {
    await activateQuestion(sessionId, 'q1');

    await page.goto(`/?s=${sessionId}`);
    await page.evaluate(() => {
      localStorage.removeItem('dorandoran_joined_sessions');
      localStorage.removeItem('dorandoran_participant_id');
      localStorage.removeItem('dorandoran_nickname');
    });
    await page.reload();

    await page.getByPlaceholder('닉네임 입력').fill('질문학생');
    await page.getByText('참여하기').click();
    await expect(page.getByText('좋아하는 프로그래밍 언어는?')).toBeVisible({ timeout: 10000 });

    // "긴급" button opens urgent question bottom sheet
    const urgentBtn = page.getByRole('button', { name: '긴급 질문 보내기' });
    if (await urgentBtn.isVisible()) {
      await urgentBtn.click();

      // Fill in question text in the bottom sheet
      const textarea = page.getByLabel('긴급 질문 내용');
      await expect(textarea).toBeVisible({ timeout: 5000 });
      await textarea.fill('이해가 안 되는 부분이 있습니다');
      await page.getByRole('button', { name: '보내기', exact: true }).click();

      await waitForSync(page, 2000);

      // Verify in Firebase
      const urgentQs = await firebaseGet(`sessions/${sessionId}/urgentQuestions`);
      expect(urgentQs).toBeTruthy();
      const entries = Object.values(urgentQs);
      expect(entries.some((q) => q.text === '이해가 안 되는 부분이 있습니다')).toBe(true);
    }
  });
});
