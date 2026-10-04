import { test, expect } from '@playwright/test';
import { waitForSync } from './helpers';

const ADMIN = { uid: 'e2e_admin_master', username: 'test_master', displayName: '테스트 강사', role: 'master' };

/** 세션 생성 — '기업 행사모드' 토글 UI 캡처/검수. */
test('세션 생성 확인 단계 — 기업 행사모드 토글', async ({ page, baseURL }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseURL}/admin`);
  await page.evaluate((u) => sessionStorage.setItem('dorandoran_admin', JSON.stringify(u)), ADMIN);
  await page.goto(`${baseURL}/admin`);
  await waitForSync(page, 2000);

  await page.getByRole('button', { name: /새 클래스/ }).first().click();
  await waitForSync(page, 500);
  await page.getByRole('button', { name: /새 강의 만들기/ }).click();
  await waitForSync(page, 400);
  await page.getByLabel('강의 이름').fill('2026 전사 워크샵');
  await page.getByRole('button', { name: /다음/ }).click();
  await waitForSync(page, 600);

  // 확인 단계: 기업 행사모드 토글 노출
  await expect(page.getByText('기업 행사모드')).toBeVisible();
  await expect(page.getByText('입장 시 사번(직원번호)을 필수로 받습니다')).toBeVisible();
  await page.screenshot({ path: 'test-results/responsive-admin/create-toggle-off.png' });

  // 토글 ON
  await page.getByText('기업 행사모드').click();
  await waitForSync(page, 400);
  await page.screenshot({ path: 'test-results/responsive-admin/create-toggle-on.png' });
});
