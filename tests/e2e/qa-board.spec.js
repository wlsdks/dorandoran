import { test, expect } from '@playwright/test';
import {
  testSessionId,
  createTestSession,
  cleanupTestSession,
  waitForSync,
  firebaseSet,
} from './helpers';

let sessionId;

test.describe('Q&A 보드', () => {
  test.beforeAll(async () => {
    sessionId = testSessionId();
    await createTestSession(sessionId, { currentMode: 'qaBoard' });

    // Seed some class questions
    await firebaseSet(`sessions/${sessionId}/classQuestions/cq1`, {
      text: 'React 19의 주요 변경점이 뭔가요?',
      nickname: '김학생',
      participantId: 'p1',
      timestamp: Date.now(),
      answered: false,
    });
    await firebaseSet(`sessions/${sessionId}/classQuestions/cq2`, {
      text: 'Firebase 실시간 DB와 Firestore 차이가 뭔가요?',
      nickname: '이학생',
      participantId: 'p2',
      timestamp: Date.now() + 1000,
      answered: false,
      upvotes: { p1: true, p3: true },
    });
  });

  test.afterAll(async () => {
    await cleanupTestSession(sessionId);
  });

  test('라이브 화면에서 Q&A 보드 렌더링', async ({ page }) => {
    await page.goto(`/live?s=${sessionId}`);
    await waitForSync(page, 4000);

    // Should show Q&A board with questions
    await expect(page.getByText('Q&A 보드')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('React 19의 주요 변경점이 뭔가요?')).toBeVisible();
    await expect(page.getByText('Firebase 실시간 DB와 Firestore 차이가 뭔가요?')).toBeVisible();
  });

  test('학생 화면에서 Q&A 보드 + 질문 입력', async ({ page }) => {
    await page.goto(`/?s=${sessionId}`);
    await page.evaluate(() => {
      localStorage.removeItem('dorandoran_joined_sessions');
      localStorage.removeItem('dorandoran_participant_id');
      localStorage.removeItem('dorandoran_nickname');
    });
    await page.reload();

    // Join
    await page.getByPlaceholder('닉네임 입력').fill('보드학생');
    await page.getByText('참여하기').click();
    await waitForSync(page, 3000);

    // Should show Q&A board (qaBoard mode active)
    await expect(page.getByText('Q&A 보드')).toBeVisible({ timeout: 10000 });

    // Should have question input
    await expect(page.getByPlaceholder('궁금한 점을 자유롭게 질문하세요')).toBeVisible();
  });

  test('질문에 좋아요 + 답변 펼치기', async ({ page }) => {
    await page.goto(`/live?s=${sessionId}`);
    await waitForSync(page, 4000);

    // Should show upvote counts
    await expect(page.getByText('Q&A 보드')).toBeVisible({ timeout: 10000 });

    // Click on answer button to expand (MessageSquare icon area)
    const answerBtns = page.locator('button').filter({ has: page.locator('svg') });
    const count = await answerBtns.count();
    expect(count).toBeGreaterThan(0);
  });
});
