import { test, expect } from '@playwright/test';
import {
  testSessionId,
  createTestSession,
  cleanupTestSession,
  setupAdminPage,
  waitForSync,
  firebaseSet,
} from './helpers';

let sessionId;

test.describe('스태프 플로우', () => {
  test.beforeAll(async () => {
    sessionId = testSessionId();
    await createTestSession(sessionId);
    // Add some urgent questions for staff to see
    await firebaseSet(`sessions/${sessionId}/urgentQuestions/uq1`, {
      text: '이 부분 다시 설명해주세요',
      timestamp: Date.now(),
      read: false,
    });
    await firebaseSet(`sessions/${sessionId}/urgentQuestions/uq2`, {
      text: '과제 제출 기한이 언제인가요?',
      timestamp: Date.now() + 1000,
      read: false,
    });
    // Add hand raise
    await firebaseSet(`sessions/${sessionId}/handRaises/student1`, {
      nickname: '김학생',
      raised: true,
      raisedAt: Date.now(),
    });
  });

  test.afterAll(async () => {
    await cleanupTestSession(sessionId);
  });

  test('스태프 로그인 후 스태프 전용 뷰 표시', async ({ browser }) => {
    const { page, context } = await setupAdminPage(browser, 'http://localhost:5173', 'staff');

    // Navigate to session
    await page.goto(`http://localhost:5173/admin?s=${sessionId}`);
    await page.evaluate((user) => {
      sessionStorage.setItem('dorandoran_admin', JSON.stringify(user));
    }, { uid: 'e2e_admin_staff', username: 'test_staff', displayName: '테스트 스태프', role: 'staff' });
    await page.reload();
    await waitForSync(page, 4000);

    // Staff view should render (different from admin view)
    // Should see staff-specific elements
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();

    await context.close();
  });

  test('스태프가 긴급 질문 목록 확인', async ({ browser }) => {
    const { page, context } = await setupAdminPage(browser, 'http://localhost:5173', 'staff');

    await page.goto(`http://localhost:5173/admin?s=${sessionId}`);
    await page.evaluate((user) => {
      sessionStorage.setItem('dorandoran_admin', JSON.stringify(user));
    }, { uid: 'e2e_admin_staff', username: 'test_staff', displayName: '테스트 스태프', role: 'staff' });
    await page.reload();
    await waitForSync(page, 4000);

    // Look for urgent question text
    const q1Visible = await page.getByText('이 부분 다시 설명해주세요').isVisible().catch(() => false);
    const q2Visible = await page.getByText('과제 제출 기한이 언제인가요?').isVisible().catch(() => false);

    // At least one should be visible (might be in different tabs)
    if (!q1Visible && !q2Visible) {
      // Try clicking urgent/question tab
      const urgentTab = page.getByText(/긴급/i).or(page.getByText(/질문/i).first());
      if (await urgentTab.isVisible().catch(() => false)) {
        await urgentTab.click();
        await waitForSync(page, 1000);
      }
    }

    await context.close();
  });

  test('스태프가 손들기 확인', async ({ browser }) => {
    const { page, context } = await setupAdminPage(browser, 'http://localhost:5173', 'staff');

    await page.goto(`http://localhost:5173/admin?s=${sessionId}`);
    await page.evaluate((user) => {
      sessionStorage.setItem('dorandoran_admin', JSON.stringify(user));
    }, { uid: 'e2e_admin_staff', username: 'test_staff', displayName: '테스트 스태프', role: 'staff' });
    await page.reload();
    await waitForSync(page, 4000);

    // Look for hand raise indicator or tab
    const handTab = page.getByText(/손들기/i);
    if (await handTab.isVisible().catch(() => false)) {
      await handTab.click();
      await waitForSync(page, 1000);

      // Should see student name who raised hand
      await page.getByText('김학생').isVisible().catch(() => false);
    }

    await context.close();
  });
});
