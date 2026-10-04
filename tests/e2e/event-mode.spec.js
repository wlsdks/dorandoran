import { test, expect } from '@playwright/test';
import {
  testSessionId, createTestSession, cleanupTestSession,
  waitForSync, firebaseGet,
} from './helpers';

/**
 * 기업 행사모드(사번 필수) + 사번(선택) end-to-end 기능 검증.
 * 입장 차단/허용 + participant 레코드에 employeeId 저장까지 Firebase로 확인.
 */

async function gotoJoin(page, baseURL, sid, pid) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/?s=${sid}`);
  // 알려진 participantId로 고정 — 이후 participants/{pid} 검증
  await page.evaluate((p) => localStorage.setItem('dorandoran_participant_id', p), pid);
  await page.reload();
  await waitForSync(page, 1500);
}

test('행사모드 — 사번 없이 입장 불가, 사번 입력 시 입장 + employeeId 저장', async ({ page, baseURL }) => {
  test.setTimeout(60_000);
  const sid = testSessionId();
  await createTestSession(sid, { requireEmployeeId: true });
  const pid = 'e2e_evt_required';
  await gotoJoin(page, baseURL, sid, pid);

  // 닉네임만 입력 → 참여하기 비활성
  await page.getByLabel('닉네임').fill('김참가');
  await waitForSync(page, 400);
  await expect(page.getByRole('button', { name: /참여하기/ })).toBeDisabled();

  // 사번 입력 → 활성 → 입장
  await page.getByLabel('사번 (필수)').fill('20260042');
  await waitForSync(page, 400);
  const joinBtn = page.getByRole('button', { name: /참여하기/ });
  await expect(joinBtn).toBeEnabled();
  await joinBtn.click();
  await waitForSync(page, 2500);

  // participant 레코드에 employeeId 저장됐는지 Firebase로 확인
  const participant = await firebaseGet(`sessions/${sid}/participants/${pid}`);
  expect(participant?.nickname).toBe('김참가');
  expect(participant?.employeeId).toBe('20260042');
  await cleanupTestSession(sid);
});

test('일반모드 — 닉네임만으로 입장 가능(사번 미입력)', async ({ page, baseURL }) => {
  test.setTimeout(60_000);
  const sid = testSessionId();
  await createTestSession(sid); // requireEmployeeId 없음
  const pid = 'e2e_evt_optional';
  await gotoJoin(page, baseURL, sid, pid);

  // 닉네임만 입력 → 바로 참여 가능
  await page.getByLabel('닉네임').fill('이참가');
  await waitForSync(page, 400);
  const joinBtn = page.getByRole('button', { name: /참여하기/ });
  await expect(joinBtn).toBeEnabled();
  await joinBtn.click();
  await waitForSync(page, 2500);

  const participant = await firebaseGet(`sessions/${sid}/participants/${pid}`);
  expect(participant?.nickname).toBe('이참가');
  expect(participant?.employeeId).toBeFalsy(); // 미입력 → 저장 안 됨
  await cleanupTestSession(sid);
});
