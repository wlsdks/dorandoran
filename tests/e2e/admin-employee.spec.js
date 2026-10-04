import { test, expect } from '@playwright/test';
import { testSessionId, createTestSession, cleanupTestSession, waitForSync, firebaseSet } from './helpers';

const ADMIN = { uid: 'e2e_admin_master', username: 'test_master', displayName: '테스트 강사', role: 'master' };

/** 강사 참여자 목록에 사번 표시 + 학생 화면엔 미노출 검증. */
test('강사 참여자 목록 — 닉네임 아래 사번 표시', async ({ page, baseURL }) => {
  test.setTimeout(60_000);
  const sid = testSessionId();
  await createTestSession(sid, { requireEmployeeId: true });
  // 사번 있는 참여자 + 없는 참여자 시드
  await firebaseSet(`sessions/${sid}/participants`, {
    p1: { nickname: '김참가', online: true, employeeId: '20260042' },
    p2: { nickname: '이참가', online: true, employeeId: '20260117' },
    p3: { nickname: '박참가', online: true },
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseURL}/admin`);
  await page.evaluate((u) => sessionStorage.setItem('dorandoran_admin', JSON.stringify(u)), ADMIN);
  await page.goto(`${baseURL}/admin?s=${sid}`);
  await page.getByText('불러오는 중').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  await waitForSync(page, 2500);

  // 강사 화면에 사번 노출
  await expect(page.getByText('사번 20260042')).toBeVisible();
  await expect(page.getByText('김참가')).toBeVisible();
  await page.screenshot({ path: 'test-results/responsive-admin/employee-list.png' });
  await cleanupTestSession(sid);
});
