import { test } from '@playwright/test';
import {
  testSessionId, createTestSession, cleanupTestSession,
  activateQuestion, waitForSync, firebaseSet,
} from './helpers';

/**
 * 강사(admin) 화면 + 발표모드(전자칠판) + 첫 QR화면 반응형 캡처.
 * 노트북(1440×900)·태블릿(1024×768)·프로젝터(1920×1080)에서 깨짐/잘림 검수.
 */

const OUT = 'test-results/responsive-admin';
const ADMIN = { uid: 'e2e_admin_master', username: 'test_master', displayName: '테스트 강사', role: 'master' };

async function setAdminAuth(page, baseURL) {
  await page.goto(`${baseURL}/admin`);
  await page.evaluate((u) => sessionStorage.setItem('dorandoran_admin', JSON.stringify(u)), ADMIN);
}

async function shoot(page, label) {
  await page.getByText('불러오는 중').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  await waitForSync(page, 1800);
  await page.screenshot({ path: `${OUT}/${label}.png`, fullPage: false });
}

test('강사 — 로그인 화면 (1440×900)', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseURL}/admin`);
  await shoot(page, 'laptop-01-login');
});

test('강사 — 세션 목록 대시보드 (1440×900)', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setAdminAuth(page, baseURL);
  await page.goto(`${baseURL}/admin`);
  await shoot(page, 'laptop-02-sessions');
});

for (const dev of [{ w: 1440, h: 900, tag: 'laptop' }, { w: 1024, h: 768, tag: 'tablet' }, { w: 1000, h: 768, tag: 'tabletdrawer' }, { w: 768, h: 1024, tag: 'ipadportrait' }]) {
  test(`강사 — 세션 대시보드(질문관리) ${dev.tag} (${dev.w}×${dev.h})`, async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const sid = testSessionId();
    await createTestSession(sid);
    await page.setViewportSize({ width: dev.w, height: dev.h });
    await setAdminAuth(page, baseURL);
    await page.goto(`${baseURL}/admin?s=${sid}`);
    await shoot(page, `${dev.tag}-03-dashboard`);
    // 활성 질문 상태의 대시보드(결과 보임)
    await activateQuestion(sid, 'q1');
    await firebaseSet(`sessions/${sid}/questions/q1/votes`, { a: { value: 'JavaScript' }, b: { value: 'Go' }, c: { value: 'Go' } });
    await page.reload();
    await shoot(page, `${dev.tag}-04-dashboard-active`);
    await cleanupTestSession(sid);
  });
}

test('강사 — 발표모드 첫 QR화면 + 활성질문 (1920×1080)', async ({ page, baseURL }) => {
  test.setTimeout(120_000);
  const sid = testSessionId();
  await createTestSession(sid); // currentQuestion null → QR 화면
  await page.setViewportSize({ width: 1920, height: 1080 });
  await setAdminAuth(page, baseURL);
  await page.goto(`${baseURL}/admin?s=${sid}`);
  await shoot(page, 'present-00-dashboard');

  // 발표 모드 진입 → QR 화면
  const presentBtn = page.getByRole('button', { name: /발표 모드|발표/ }).first();
  await presentBtn.click().catch(() => {});
  await shoot(page, 'present-01-qr');

  // 활성 질문 발표 화면
  await activateQuestion(sid, 'q1');
  await firebaseSet(`sessions/${sid}/questions/q1/votes`, { a: { value: 'JavaScript' }, b: { value: 'Go' }, c: { value: 'Go' }, d: { value: 'Python' } });
  await shoot(page, 'present-02-choice');
  await cleanupTestSession(sid);
});
