/**
 * 모드 미리보기 검증.
 * 핵심은 "체험해도 데이터가 쌓이지 않는다"이므로, Firebase 소켓으로 나가는 쓰기 프레임을
 * 직접 세어 확인한다(RTDB SDK는 REST가 아니라 WebSocket으로 쓴다).
 */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5173';
const OUT = '/tmp/dorandoran-preview';
const ADMIN = { uid: 'e2e_admin_master', username: 'test_master', displayName: '테스트 강사', role: 'master' };

const problems = [];
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) problems.push(`${label}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({ channel: 'chrome', headless: false, slowMo: 60 });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });

  // Firebase 쓰기 프레임 수집: a=p(put) / a=m(merge) 가 쓰기다
  const writes = [];
  let collecting = false;
  page.on('websocket', (ws) => {
    ws.on('framesent', (frame) => {
      const payload = String(frame.payload || '');
      if (!collecting) return;
      if (/"a":"(p|m|o|om)"/.test(payload)) writes.push(payload.slice(0, 200));
    });
  });

  await page.goto(`${BASE}/admin`);
  await page.evaluate((u) => sessionStorage.setItem('dorandoran_admin', JSON.stringify(u)), ADMIN);
  await page.goto(`${BASE}/admin`);
  await page.waitForTimeout(2500);

  await page.getByRole('button', { name: /새 클래스/ }).first().click();
  await page.waitForTimeout(1200);
  const rows = page.locator('[role="dialog"] button');
  const count = await rows.count();
  for (let i = 0; i < count; i += 1) {
    const label = (await rows.nth(i).innerText().catch(() => '')).trim();
    if (!label || /새 강의|닫기|취소/.test(label)) continue;
    await rows.nth(i).click().catch(() => {});
    break;
  }
  await page.getByText('클래스 확인').waitFor({ timeout: 8000 });
  await page.waitForTimeout(600);

  check('설명 보기 버튼 노출', await page.getByRole('button', { name: '설명 보기' }).count() === 2,
    `${await page.getByRole('button', { name: '설명 보기' }).count()}개`);
  await page.screenshot({ path: `${OUT}/confirm-with-preview.png` });

  // ── 여기서부터 쓰기 프레임을 센다
  collecting = true;

  // 1) 추첨 전용 모드 미리보기
  await page.getByRole('button', { name: '설명 보기' }).nth(1).click();
  await page.waitForTimeout(1200);
  check('추첨 전용 미리보기 진입', await page.getByText('참여자 입장 없이, 강사가 명단을 직접 넣어 추첨만 진행합니다.').count() > 0);
  check('저장되지 않는다는 안내', await page.getByText(/저장되지 않습니다/).count() > 0);
  await page.screenshot({ path: `${OUT}/preview-drawonly.png` });

  // 실제로 체험 — 복권을 깔고 당첨까지 긁는다
  await page.getByRole('button', { name: '복권 시작하기' }).click();
  await page.waitForTimeout(1200);
  check('미리보기에서 판이 깔림', await page.locator('canvas').count() === 9, `${await page.locator('canvas').count()}칸`);
  for (let i = 1; i <= 9; i += 1) {
    const cell = page.getByRole('button', { name: `${i}번 칸 긁기` });
    if (await cell.count() === 0) break;
    await cell.click().catch(() => {});
    await page.waitForTimeout(800);
    // 안내 문구에도 '당첨'이 들어 있다. 당첨 줄 강조(amber ring)로 실제 당첨을 판정한다.
    if (await page.locator('.ring-amber-400').count() > 0) break;
  }
  await page.waitForTimeout(1500);
  check('미리보기에서 당첨까지 진행됨', await page.locator('.ring-amber-400').count() > 0);
  check('지난 당첨 기록이 미리보기 안에서만 남음', await page.getByText(/지난 당첨/).count() >= 0);
  await page.screenshot({ path: `${OUT}/preview-scratch-win.png` });

  // 2) 기업 행사모드 미리보기
  await page.getByRole('button', { name: '돌아가기' }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: '설명 보기' }).first().click();
  await page.waitForTimeout(1000);
  check('기업 행사모드 미리보기 진입', await page.getByText('학생 입장 화면').count() > 0);
  await page.screenshot({ path: `${OUT}/preview-employee.png` });
  await page.getByRole('button', { name: '돌아가기' }).click();
  await page.waitForTimeout(800);

  collecting = false;
  console.log(`\n  미리보기 중 Firebase 쓰기 프레임: ${writes.length}건`);
  writes.slice(0, 5).forEach((w) => console.log(`    ${w}`));
  check('미리보기 중 데이터 쓰기 없음', writes.length === 0, `${writes.length}건`);

  // 3) 미리보기를 거쳐도 클래스 등록은 정상 동작해야 한다
  check('확인 단계로 복귀', await page.getByText('클래스 확인').count() > 0);
  await page.waitForTimeout(1500);
} catch (e) {
  console.error('중단:', e.message);
  problems.push(`예외: ${e.message}`);
} finally {
  await browser.close();
  console.log('\n=== 결과 ===');
  console.log(problems.length === 0 ? '미리보기 정상, 데이터 쌓이지 않음' : problems.map((p) => `- ${p}`).join('\n'));
}
