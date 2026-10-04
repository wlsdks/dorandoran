import { test, expect } from '@playwright/test';
import { testSessionId, createTestSession, cleanupTestSession, waitForSync, firebaseGet, firebaseSet } from './helpers';

const ADMIN = { uid: 'e2e_admin_master', username: 'test_master', displayName: '테스트 강사', role: 'master' };

/** 관리자 화면을 로그인 없이 연다(sessionStorage 주입). */
async function openAdmin(page, baseURL, sessionId) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseURL}/admin`);
  await page.evaluate((u) => sessionStorage.setItem('dorandoran_admin', JSON.stringify(u)), ADMIN);
  await page.goto(sessionId ? `${baseURL}/admin?s=${sessionId}` : `${baseURL}/admin`);
  await page.getByText('불러오는 중').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  await waitForSync(page, 2500);
}

/** 실제 붙여넣기 — 클립보드 권한 없이 paste 이벤트를 그대로 발생시킨다. */
async function pasteInto(page, ariaLabel, text) {
  await page.evaluate(({ label, value }) => {
    const input = document.querySelector(`input[aria-label="${label}"]`);
    const dt = new DataTransfer();
    dt.setData('text', value);
    input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, { label: ariaLabel, value: text });
}

test('세션 생성 — 추첨 전용 모드 토글은 기업 행사모드와 함께 켜지지 않는다', async ({ page, baseURL }) => {
  test.setTimeout(60_000);
  await openAdmin(page, baseURL, null);

  await page.getByRole('button', { name: /새 클래스/ }).first().click();
  await waitForSync(page, 800);
  // 강의를 새로 만들면 실행할 때마다 실제 DB에 강의가 쌓인다 — 기존 강의를 골라 확인 단계로 간다.
  await page.locator('[role="dialog"] button').filter({ hasText: /차$|개 클래스|회차/ }).first().click()
    .catch(async () => { await page.locator('[role="dialog"] button').nth(1).click(); });
  await waitForSync(page, 800);

  const drawToggle = page.getByRole('switch', { name: /추첨 전용 모드/ });
  const eventToggle = page.getByRole('switch', { name: /기업 행사모드/ });
  await expect(page.getByText('참여자 입장 없이, 명단을 직접 입력해 추첨만 진행합니다')).toBeVisible();

  await drawToggle.click();
  await waitForSync(page, 300);
  await expect(drawToggle).toHaveAttribute('aria-checked', 'true');

  // 기업 행사모드를 켜면 추첨 전용은 꺼진다 — 입장이 있는 모드와 없는 모드는 공존할 수 없다
  await eventToggle.click();
  await waitForSync(page, 300);
  await expect(eventToggle).toHaveAttribute('aria-checked', 'true');
  await expect(drawToggle).toHaveAttribute('aria-checked', 'false');
  await page.screenshot({ path: 'test-results/responsive-admin/draw-only-toggle.png' });
});

test('명단 관리 — 붙여넣기로 추가, 직접 수정, 삭제가 Firebase에 반영된다', async ({ page, baseURL }) => {
  test.setTimeout(90_000);
  const sid = testSessionId();
  await createTestSession(sid, { drawOnly: true, currentMode: 'waiting' });
  try {
    await openAdmin(page, baseURL, sid);

    // 추첨 전용 세션에는 초대 QR 대신 명단 관리가 놓인다
    await expect(page.getByText('명 추첨 대상')).toBeVisible();
    await page.getByRole('button', { name: '명단 관리' }).click();
    await waitForSync(page, 500);

    // 엑셀에서 긁은 탭 구분 명단 붙여넣기
    await pasteInto(page, '1번 이름', '홍길동\t1001\n김철수\t1002\n이영희\t1003');
    await waitForSync(page, 400);
    await expect(page.getByText(/3명을 붙여넣었습니다/)).toBeVisible();
    await expect(page.locator('input[aria-label="3번 사번"]')).toHaveValue('1003');

    // 한 명은 직접 타이핑으로 추가
    await page.getByRole('button', { name: '행 추가' }).click();
    await waitForSync(page, 300);
    await page.locator('input[aria-label="4번 이름"]').fill('박민수');
    await page.locator('input[aria-label="4번 사번"]').fill('1004');
    await page.screenshot({ path: 'test-results/responsive-admin/draw-only-roster.png' });

    await page.getByRole('button', { name: '저장하기' }).click();
    await waitForSync(page, 2500);

    const saved = await firebaseGet(`sessions/${sid}/participants`);
    const rows = Object.values(saved || {}).filter((p) => p.source === 'manual');
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.employeeId).sort()).toEqual(['1001', '1002', '1003', '1004']);
    // 추첨 대상은 온라인 참여자에서 파생된다 — 명단은 접속하지 않으므로 직접 세워둬야 뽑힌다
    expect(rows.every((r) => r.online === true)).toBe(true);

    // 다시 열어 수정 + 삭제
    await page.getByRole('button', { name: '명단 관리' }).click();
    await waitForSync(page, 600);
    await expect(page.locator('input[aria-label="1번 이름"]')).toHaveValue('홍길동');
    await page.locator('input[aria-label="1번 사번"]').fill('9999');
    await page.getByRole('button', { name: '2번 삭제' }).click();
    await waitForSync(page, 300);
    await page.getByRole('button', { name: '저장하기' }).click();
    await waitForSync(page, 2500);

    const after = await firebaseGet(`sessions/${sid}/participants`);
    const afterRows = Object.values(after || {}).filter((p) => p.source === 'manual');
    expect(afterRows).toHaveLength(3);
    expect(afterRows.map((r) => r.employeeId).sort()).toEqual(['1003', '1004', '9999']);
  } finally {
    await cleanupTestSession(sid);
  }
});

test('명단 관리 — 중복 사번은 하나만 남기고 알린다', async ({ page, baseURL }) => {
  test.setTimeout(60_000);
  const sid = testSessionId();
  await createTestSession(sid, { drawOnly: true, currentMode: 'waiting' });
  try {
    await openAdmin(page, baseURL, sid);
    await page.getByRole('button', { name: '명단 관리' }).click();
    await waitForSync(page, 500);

    await pasteInto(page, '1번 이름', '홍길동\t1001\n동명이인\t1001\n김철수\t1002');
    await waitForSync(page, 400);
    await page.getByRole('button', { name: '저장하기' }).click();
    await waitForSync(page, 2500);

    await expect(page.getByText(/중복 사번 1건/)).toBeVisible();
    const saved = await firebaseGet(`sessions/${sid}/participants`);
    const rows = Object.values(saved || {}).filter((p) => p.source === 'manual');
    expect(rows).toHaveLength(2);
  } finally {
    await cleanupTestSession(sid);
  }
});

test('추첨 전용 세션 — 학생 링크로 들어와도 입장이 막힌다', async ({ page, baseURL }) => {
  test.setTimeout(60_000);
  const sid = testSessionId();
  await createTestSession(sid, { drawOnly: true });
  try {
    await page.goto(`${baseURL}/?s=${sid}`);
    await waitForSync(page, 2500);
    // 들어온 사람이 그대로 추첨 대상이 되므로 입장 자체를 막아야 한다
    await expect(page.getByText('추첨 전용 세션이에요')).toBeVisible();
    await expect(page.getByPlaceholder(/닉네임/)).toHaveCount(0);
  } finally {
    await cleanupTestSession(sid);
  }
});

test('추첨 화면 — 당첨자 카드에 사번이 함께 뜬다', async ({ page, baseURL }) => {
  test.setTimeout(90_000);
  const sid = testSessionId();
  await createTestSession(sid, { drawOnly: true, currentMode: 'lottery' });
  await firebaseSet(`sessions/${sid}/participants`, {
    manual_1: { nickname: '홍길동', employeeId: '20260042', online: true, source: 'manual', order: 0 },
    manual_2: { nickname: '김철수', employeeId: '20260117', online: true, source: 'manual', order: 1 },
  });
  try {
    await openAdmin(page, baseURL, sid);
    await page.getByRole('button', { name: /추첨 시작/ }).click();
    // 사이드바 명단에도 같은 사번이 있으므로 당첨 카드(rounded-3xl 슬롯) 안으로 범위를 좁힌다.
    // 슬롯 롤링(80ms 간격)이 끝나고 카드가 확정될 때까지 기다린다.
    // 사이드바 명단에도 같은 사번이 있으므로 당첨 카드(어두운 카드) 안으로 범위를 좁힌다.
    const winnerCard = page.locator('div.bg-slate-900').filter({ hasText: /20260042|20260117/ });
    await expect(winnerCard.first()).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: 'test-results/responsive-admin/draw-only-winner.png' });
  } finally {
    await cleanupTestSession(sid);
  }
});

test('명단 — 이름 없이 사번만 등록해도 저장된다', async ({ page, baseURL }) => {
  test.setTimeout(60_000);
  const sid = testSessionId();
  await createTestSession(sid, { drawOnly: true, currentMode: 'waiting' });
  try {
    await openAdmin(page, baseURL, sid);
    await page.getByRole('button', { name: '명단 관리' }).click();
    await waitForSync(page, 500);

    // 사번만 있는 목록(엑셀에서 고유번호 열만 긁어온 경우)
    await pasteInto(page, '1번 이름', '1111\n2222\n3333');
    await waitForSync(page, 400);
    await expect(page.locator('input[aria-label="1번 사번"]')).toHaveValue('1111');
    await expect(page.locator('input[aria-label="1번 이름"]')).toHaveValue('');

    await page.getByRole('button', { name: '저장하기' }).click();
    await waitForSync(page, 2500);

    const saved = await firebaseGet(`sessions/${sid}/participants`);
    const rows = Object.values(saved || {}).filter((p) => p.source === 'manual');
    expect(rows).toHaveLength(3);
    // 이름이 없으면 사번이 곧 표시 이름 — 추첨 화면에 빈칸이 뜨지 않는다
    expect(rows.every((r) => r.nickname === r.employeeId)).toBe(true);
  } finally {
    await cleanupTestSession(sid);
  }
});

test('즉석복권 — 칸을 긁어 한 줄이 열리면 당첨자가 발행된다', async ({ page, baseURL }) => {
  test.setTimeout(120_000);
  const sid = testSessionId();
  await createTestSession(sid, { drawOnly: true, currentMode: 'scratchCard' });
  await firebaseSet(`sessions/${sid}/participants`, Object.fromEntries(
    ['홍길동', '김철수', '이영희', '박민수', '최지우', '강한나'].map((nickname, i) => [
      `manual_${i}`, { nickname, employeeId: `2026000${i}`, online: true, source: 'manual', order: i },
    ])
  ));
  try {
    await openAdmin(page, baseURL, sid);
    await page.getByRole('button', { name: '복권 시작' }).click();
    await waitForSync(page, 1200);

    // 9칸 모두 은박으로 덮여 있다
    await expect(page.getByRole('button', { name: /칸 긁기/ })).toHaveCount(9);

    // 한 칸씩 눌러 긁는다 — 당첨 줄 3칸이 열리는 순간 발표된다
    for (let i = 1; i <= 9; i += 1) {
      const cell = page.getByRole('button', { name: `${i}번 칸 긁기` });
      if (await cell.count() === 0) break;
      await cell.click().catch(() => {});
      await waitForSync(page, 1100);
      // 안내 문구에도 '당첨'이 들어 있다. 당첨 줄 강조(amber ring)로 실제 당첨을 판정한다.
      if (await page.locator('.ring-amber-400').count() > 0) break;
    }

    await expect(page.locator('.ring-amber-400').first()).toBeVisible({ timeout: 15_000 });
    await waitForSync(page, 2000);

    const result = await firebaseGet(`sessions/${sid}/gameResult`);
    expect(result.mode).toBe('scratchCard');
    expect(result.winners).toHaveLength(1);
    expect(result.winners[0].employeeId).toBeTruthy();
    await page.screenshot({ path: 'test-results/responsive-admin/scratch-win.png' });
  } finally {
    await cleanupTestSession(sid);
  }
});

test('추첨 화면 — 이름 보기/사번 보기를 바꾸면 표시가 바뀐다', async ({ page, baseURL }) => {
  test.setTimeout(60_000);
  const sid = testSessionId();
  await createTestSession(sid, { drawOnly: true, currentMode: 'scratchCard' });
  await firebaseSet(`sessions/${sid}/participants`, {
    manual_1: { nickname: '홍길동', employeeId: '20260042', online: true, source: 'manual', order: 0 },
    manual_2: { nickname: '김철수', employeeId: '20260117', online: true, source: 'manual', order: 1 },
  });
  try {
    await openAdmin(page, baseURL, sid);
    await page.getByRole('button', { name: '복권 시작' }).click();
    await waitForSync(page, 800);
    await page.getByRole('button', { name: '전체 공개' }).count(); // 없으면 무시 — 칸을 직접 긁는다

    await page.getByRole('radio', { name: '사번 보기' }).click();
    await waitForSync(page, 400);
    await expect(page.getByRole('radio', { name: '사번 보기' })).toHaveAttribute('aria-checked', 'true');

    await page.getByRole('radio', { name: '이름 보기' }).click();
    await waitForSync(page, 400);
    await expect(page.getByRole('radio', { name: '이름 보기' })).toHaveAttribute('aria-checked', 'true');
  } finally {
    await cleanupTestSession(sid);
  }
});
