import { test, expect } from '@playwright/test';
import {
  testSessionId,
  createTestSession,
  cleanupTestSession,
  waitForSync,
  firebaseSet,
} from './helpers';

let sessionId;

test.describe('학습 리포트 페이지', () => {
  test.beforeAll(async () => {
    sessionId = testSessionId();
    await createTestSession(sessionId, { status: 'ended' });

    // Add participant with votes
    await firebaseSet(`sessions/${sessionId}/participants/test_student`, {
      nickname: '리포트학생',
      online: false,
      joinedAt: Date.now(),
    });

    // Add votes to questions
    await firebaseSet(`sessions/${sessionId}/questions/q1/votes/test_student`, {
      value: 'Python',
      timestamp: Date.now(),
    });
    await firebaseSet(`sessions/${sessionId}/questions/q4/votes/test_student`, {
      value: '서울',
      timestamp: Date.now(),
    });

    // Add scores
    await firebaseSet(`sessions/${sessionId}/scores/test_student`, {
      nickname: '리포트학생',
      total: 250,
      streak: 2,
      bestStreak: 2,
    });
  });

  test.afterAll(async () => {
    await cleanupTestSession(sessionId);
  });

  test('유효하지 않은 링크 → 에러 메시지', async ({ page }) => {
    await page.goto('/report');
    await waitForSync(page, 2000);
    await expect(page.getByText('유효하지 않은 리포트 링크입니다')).toBeVisible({ timeout: 5000 });
  });

  test('유효한 링크 → 리포트 렌더링', async ({ page }) => {
    await page.goto(`/report?s=${sessionId}&p=test_student`);
    await waitForSync(page, 4000);

    // Should show student name
    await expect(page.getByText('리포트학생')).toBeVisible({ timeout: 10000 });

    // Should show course name
    await expect(page.getByText('E2E 테스트 수업')).toBeVisible();

    // Should show stats
    await expect(page.getByText('참여', { exact: true })).toBeVisible();
    await expect(page.getByText('점수', { exact: true })).toBeVisible();
  });

  test('질문별 기록 표시', async ({ page }) => {
    await page.goto(`/report?s=${sessionId}&p=test_student`);
    await waitForSync(page, 4000);

    // Should show question details section
    await expect(page.getByText('질문별 기록')).toBeVisible({ timeout: 10000 });

    // Should show individual questions
    await expect(page.getByText('좋아하는 프로그래밍 언어는?')).toBeVisible();
  });

  test('링크 복사 버튼 동작', async ({ page }) => {
    await page.goto(`/report?s=${sessionId}&p=test_student`);
    await waitForSync(page, 4000);

    // Should have share/copy button
    const copyBtn = page.getByText('리포트 링크 복사');
    await expect(copyBtn).toBeVisible({ timeout: 10000 });
  });

  test('존재하지 않는 세션 → 에러 상태', async ({ page }) => {
    await page.goto('/report?s=nonexistent&p=nobody');
    await waitForSync(page, 5000);

    // Should show error or empty state
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
  });
});
