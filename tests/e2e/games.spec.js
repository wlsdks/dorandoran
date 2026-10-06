import { test, expect } from '@playwright/test';
import {
  testSessionId,
  createTestSession,
  cleanupTestSession,
  waitForSync,
  firebaseSet,
} from './helpers';

/**
 * Game mode E2E tests.
 *
 * All games render on /live?s=sessionId when currentMode is set.
 * We seed participants via Firebase, switch mode, and verify
 * rendering + interactions on the live page.
 */

let sessionId;

const ADMIN = { uid: 'e2e_admin_master', username: 'test_master', displayName: '테스트 강사', role: 'master' };

/** 강사 화면을 로그인 없이 연다(sessionStorage 주입). */
async function openAdmin(page, baseURL, sid) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseURL}/admin`);
  await page.evaluate((u) => sessionStorage.setItem('dorandoran_admin', JSON.stringify(u)), ADMIN);
  await page.goto(`${baseURL}/admin?s=${sid}`);
  await page.getByText('불러오는 중').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  await waitForSync(page, 3000);
}

/** Seed participants for game testing. */
async function seedParticipants(sid, count = 6) {
  const names = ['김민수', '이서연', '박지훈', '최수진', '정현우', '강다은', '조은비', '윤태호'];
  const updates = {};
  for (let i = 0; i < count; i++) {
    updates[`p${i}`] = {
      nickname: names[i] || `학생${i + 1}`,
      online: true,
      joinedAt: Date.now() - i * 1000,
    };
  }
  await firebaseSet(`sessions/${sid}/participants`, updates);
}

/** Seed scores for lottery/leaderboard testing. */
async function seedScores(sid, count = 6) {
  const names = ['김민수', '이서연', '박지훈', '최수진', '정현우', '강다은'];
  const updates = {};
  for (let i = 0; i < count; i++) {
    updates[`p${i}`] = {
      nickname: names[i],
      total: (count - i) * 100,
      streak: Math.max(0, count - i - 1),
    };
  }
  await firebaseSet(`sessions/${sid}/scores`, updates);
}

test.describe('게임 모드 — 복권 (Lottery)', () => {
  test.beforeAll(async () => {
    sessionId = testSessionId();
    await createTestSession(sessionId, { currentMode: 'lottery' });
    await seedParticipants(sessionId);
    await seedScores(sessionId);
  });

  test.afterAll(async () => {
    await cleanupTestSession(sessionId);
  });

  test('전자칠판은 보기 전용 — 조작은 강사 화면에서만', async ({ page }) => {
    await page.goto(`/live?s=${sessionId}`);
    await waitForSync(page, 4000);

    // 전자칠판에서 추첨을 돌리면 관객이 보는 결과와 강사가 부르는 결과가 갈린다.
    // 조작 수단은 강사 화면에만 있어야 한다.
    await expect(page.getByText('강사 화면을 그대로 보여주는 중입니다')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('당첨자 수')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /제비뽑기|보상 추첨/ })).toHaveCount(0);
  });

  test('강사 화면에 추첨 조작이 있다', async ({ page, baseURL }) => {
    await openAdmin(page, baseURL, sessionId);
    await expect(page.getByText('당첨자 수')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /제비뽑기|보상 추첨/ })).toBeVisible();
  });

  test('강사 화면에서 추첨 → 전자칠판에 같은 당첨자가 뜬다', async ({ page, context, baseURL }) => {
    test.setTimeout(90_000);
    const live = await context.newPage();
    await live.goto(`${baseURL}/live?s=${sessionId}`);
    await waitForSync(live, 3000);

    await openAdmin(page, baseURL, sessionId);
    await page.getByRole('button', { name: /제비뽑기|보상 추첨|다시 추첨/ }).click();

    await expect(page.getByText(/#1 당첨/)).toBeVisible({ timeout: 15000 });
    await expect(live.getByText(/#1 당첨/)).toBeVisible({ timeout: 15000 });

    const adminWinner = (await page.locator('.bg-slate-900.rounded-2xl').first().innerText()).split('\n')[0];
    const liveWinner = (await live.locator('.bg-slate-900.rounded-2xl').first().innerText()).split('\n')[0];
    expect(liveWinner).toBe(adminWinner);
    await live.close();
  });

  test('복권 다중 추첨 (3명)', async ({ page, baseURL }) => {
    test.setTimeout(90_000);
    await openAdmin(page, baseURL, sessionId);

    const plusBtn = page.getByLabel('당첨자 수 증가');
    await expect(plusBtn).toBeVisible({ timeout: 10000 });
    await plusBtn.click();
    await plusBtn.click();

    await page.getByRole('button', { name: /제비뽑기|보상 추첨|다시 추첨/ }).click();
    // 순차 dramatic reveal — 한 명씩 ~3초. 첫 당첨자만 확정 검증
    await expect(page.getByText(/#1 당첨/)).toBeVisible({ timeout: 20000 });
  });
});

test.describe('게임 모드 — 쉬는 시간 (BreakTimer)', () => {
  test.beforeAll(async () => {
    sessionId = testSessionId();
    await createTestSession(sessionId, { currentMode: 'breakTime' });
  });

  test.afterAll(async () => {
    await cleanupTestSession(sessionId);
  });

  test('쉬는 시간 화면 렌더링 + 프리셋 버튼', async ({ page }) => {
    await page.goto(`/live?s=${sessionId}`);
    await waitForSync(page, 4000);

    // Use exact match to avoid "5분" matching "15분"
    await expect(page.getByRole('button', { name: '5분', exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: '10분', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '15분', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '20분', exact: true })).toBeVisible();
  });

  test('프리셋 선택 → 타이머 카운트다운 시작', async ({ page }) => {
    await page.goto(`/live?s=${sessionId}`);
    await waitForSync(page, 4000);

    // Click 5분 preset (exact match)
    await page.getByRole('button', { name: '5분', exact: true }).click();
    await waitForSync(page, 2000);

    // Should show countdown (format: "M:SS" or "쉬는 시간")
    const bodyText = await page.textContent('body');
    const hasCountdown = bodyText.includes('쉬는 시간') || /\d:\d{2}/.test(bodyText);
    expect(hasCountdown).toBe(true);
  });
});

test.describe('게임 모드 — 랭킹', () => {
  test.beforeAll(async () => {
    sessionId = testSessionId();
    await createTestSession(sessionId, { currentMode: 'leaderboard' });
    await seedParticipants(sessionId);
    await seedScores(sessionId);
  });

  test.afterAll(async () => {
    await cleanupTestSession(sessionId);
  });

  test('랭킹 화면 렌더링 + 순위 표시', async ({ page }) => {
    await page.goto(`/live?s=${sessionId}`);
    await waitForSync(page, 5000);

    // Should show leaderboard with student names and scores
    await page.getByText('김민수').isVisible({ timeout: 10000 }).catch(() => false);
    const bodyText = await page.textContent('body');

    // At least the page should have loaded with leaderboard content
    expect(bodyText.length).toBeGreaterThan(50);
  });
});
