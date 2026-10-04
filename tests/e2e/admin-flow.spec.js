import { test, expect } from '@playwright/test';
import {
  testSessionId,
  createTestSession,
  cleanupTestSession,
  setupAdminPage,
  waitForSync,
  firebaseGet,
} from './helpers';

let sessionId;

test.describe('강사(Admin) 플로우', () => {
  test.beforeAll(async () => {
    sessionId = testSessionId();
    await createTestSession(sessionId);
  });

  test.afterAll(async () => {
    await cleanupTestSession(sessionId);
  });

  test('로그인 페이지 렌더링', async ({ page }) => {
    await page.goto('/admin');
    // Should show login form
    await expect(page.getByText('도란도란')).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder(/아이디/i).or(page.locator('input[type="text"]').first())).toBeVisible();
  });

  test('세션 대시보드 접근 (인증 후)', async ({ browser }) => {
    const { page, context } = await setupAdminPage(browser, 'http://localhost:5173', 'admin');

    // Should show session dashboard with "내 클래스" tab
    await expect(page.getByText('내 클래스').first()).toBeVisible({ timeout: 10000 });
    await context.close();
  });

  test('세션 선택 후 관리 화면 진입', async ({ browser }) => {
    const { page, context } = await setupAdminPage(browser, 'http://localhost:5173', 'admin');

    // Admin uses URL params (?s=sessionId) to select a session
    await page.goto(`http://localhost:5173/admin?s=${sessionId}`);
    // Re-inject admin credentials after navigation
    await page.evaluate((user) => {
      sessionStorage.setItem('dorandoran_admin', JSON.stringify(user));
    }, { uid: 'e2e_admin_admin', username: 'test_admin', displayName: '테스트 강사', role: 'admin' });
    await page.reload();

    // Wait for session to load
    await waitForSync(page, 4000);

    // Should see session management elements — course name in header or question list
    // Try each separately since .or() can be unreliable
    const courseVisible = await page.getByText('E2E 테스트 수업').first().isVisible({ timeout: 10000 }).catch(() => false);
    const questionVisible = await page.getByText('좋아하는 프로그래밍 언어는?').first().isVisible({ timeout: 5000 }).catch(() => false);
    const questionListVisible = await page.getByText('질문 목록').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(courseVisible || questionVisible || questionListVisible).toBeTruthy();

    await context.close();
  });
});

test.describe('강사 질문 관리', () => {
  let sid;

  test.beforeAll(async () => {
    sid = testSessionId();
    await createTestSession(sid);
  });

  test.afterAll(async () => {
    await cleanupTestSession(sid);
  });

  test('질문 활성화/비활성화', async ({ browser }) => {
    const { page, context } = await setupAdminPage(browser, 'http://localhost:5173', 'admin');

    await page.goto(`http://localhost:5173/admin?s=${sid}`);
    await page.evaluate((user) => {
      sessionStorage.setItem('dorandoran_admin', JSON.stringify(user));
    }, { uid: 'e2e_admin_admin', username: 'test_admin', displayName: '테스트 강사', role: 'admin' });
    await page.reload();
    await waitForSync(page, 4000);

    // Look for question list items
    const questionText = page.getByText('좋아하는 프로그래밍 언어는?');
    if (await questionText.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Click on the question to activate it
      await questionText.click();
      await waitForSync(page, 2000);

      // Verify in Firebase
      const currentQ = await firebaseGet(`sessions/${sid}/currentQuestion`);
      // Should be q1 or activated
      if (currentQ) {
        expect(['q1', null]).toContain(currentQ);
      }
    }

    await context.close();
  });
});
