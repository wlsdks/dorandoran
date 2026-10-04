/**
 * 화면 검수 — 추첨 전용 모드가 닿는 화면을 하나씩 캡처하고, 세로로 넘치는 곳을 수치로 잡는다.
 * 사람이 눈으로 보기 전에 "화면 밖으로 흘러넘치는 화면"을 먼저 걸러내는 용도.
 */
import { chromium } from '@playwright/test';

const DB = 'https://jinan-6c884-default-rtdb.asia-southeast1.firebasedatabase.app';
const BASE = 'http://localhost:5173';
const OUT = '/tmp/dorandoran-audit';
const ADMIN = { uid: 'e2e_admin_master', username: 'test_master', displayName: '테스트 강사', role: 'master' };

const put = (p, d) => fetch(`${DB}/${p}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
const del = (p) => fetch(`${DB}/${p}.json`, { method: 'DELETE' });

const NAMES = ['홍길동', '김철수', '이영희', '박민수', '최지우', '강한나', '정우성', '한소희'];
const roster = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [
  `manual_${i}`,
  { nickname: NAMES[i % NAMES.length] + (i >= NAMES.length ? `${Math.floor(i / NAMES.length)}` : ''), employeeId: `2026${String(i + 1).padStart(4, '0')}`, online: true, source: 'manual', order: i },
]));

const findings = [];

/** 캡처 + 세로 넘침 측정. 스크롤 높이가 뷰포트의 1.15배를 넘으면 의심 사례로 기록한다. */
async function shot(page, name, viewport) {
  await page.waitForTimeout(700);
  const metrics = await page.evaluate(() => ({
    scrollH: document.documentElement.scrollHeight,
    clientH: document.documentElement.clientHeight,
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    dialogH: document.querySelector('[role="dialog"]')?.getBoundingClientRect().height || 0,
  }));
  const ratio = metrics.scrollH / metrics.clientH;
  const overflowY = ratio > 1.15;
  const overflowX = metrics.scrollW > metrics.clientW + 2;
  const dialogTooTall = metrics.dialogH > metrics.clientH;
  if (overflowY || overflowX || dialogTooTall) {
    findings.push({ name, viewport, ...metrics, ratio: ratio.toFixed(2), overflowY, overflowX, dialogTooTall });
  }
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`${overflowY || overflowX || dialogTooTall ? '⚠️ ' : '   '}${name} [${viewport}] scroll ${metrics.scrollH}/${metrics.clientH} (x${ratio.toFixed(2)})${metrics.dialogH ? ` dialog ${Math.round(metrics.dialogH)}` : ''}`);
}

async function openAdmin(page, sid) {
  await page.goto(`${BASE}/admin`);
  await page.evaluate((u) => sessionStorage.setItem('dorandoran_admin', JSON.stringify(u)), ADMIN);
  await page.goto(`${BASE}/admin?s=${sid}`);
  await page.waitForTimeout(3000);
}

const browser = await chromium.launch({ channel: 'chrome', headless: false, slowMo: 40 });

const sid = `e2e_audit_${Date.now()}`;
try {
  await put(`sessions/${sid}`, { status: 'active', currentMode: 'waiting', courseName: '검수용 행사', roundNumber: 1, createdAt: Date.now(), drawOnly: true });
  await put(`sessions/${sid}/participants`, roster(8));

  // ── 데스크톱 1440x900
  const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await openAdmin(desk, sid);
  await shot(desk, '01-desktop-sidebar', '1440x900');

  await desk.getByRole('button', { name: '명단 관리' }).click();
  await shot(desk, '02-desktop-roster-8', '1440x900');

  // 명단 40명 — 스크롤 한계 확인
  await desk.evaluate(() => {
    const input = document.querySelector('input[aria-label="1번 이름"]');
    const dt = new DataTransfer();
    dt.setData('text', Array.from({ length: 40 }, (_, i) => `사원${i}\t3${String(i).padStart(4, '0')}`).join('\n'));
    input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await shot(desk, '03-desktop-roster-40', '1440x900');
  await desk.keyboard.press('Escape');

  // 즉석복권
  await put(`sessions/${sid}/currentMode`, 'scratchCard');
  await desk.waitForTimeout(1500);
  await shot(desk, '04-desktop-scratch-idle', '1440x900');
  await desk.getByRole('button', { name: '복권 시작' }).click();
  await shot(desk, '05-desktop-scratch-board', '1440x900');
  for (let i = 1; i <= 9; i += 1) {
    const cell = desk.getByRole('button', { name: `${i}번 칸 긁기` });
    if (await cell.count() === 0) break;
    await cell.click().catch(() => {});
    await desk.waitForTimeout(950);
    if (await desk.locator('.ring-amber-400').count() > 0) break;
  }
  await shot(desk, '06-desktop-scratch-win', '1440x900');

  // 슬롯 추첨
  await put(`sessions/${sid}/currentMode`, 'lottery');
  await desk.waitForTimeout(1500);
  await shot(desk, '07-desktop-lottery-idle', '1440x900');
  await desk.getByRole('button', { name: /추첨 시작/ }).click();
  await desk.waitForTimeout(1000);
  await shot(desk, '08-desktop-lottery-rolling', '1440x900');
  await desk.waitForTimeout(3000);
  await shot(desk, '09-desktop-lottery-revealed', '1440x900');

  // 발표자 뽑기
  await put(`sessions/${sid}/currentMode`, 'randomPicker');
  await desk.waitForTimeout(1500);
  await desk.getByRole('button', { name: '발표자 뽑기' }).last().click().catch(() => {});
  await desk.waitForTimeout(4500);
  await shot(desk, '10-desktop-randompicker', '1440x900');
  await desk.close();

  // ── 전자칠판 /live (프레젠터)
  const live = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await put(`sessions/${sid}/currentMode`, 'scratchCard');
  await live.goto(`${BASE}/live?s=${sid}`);
  await live.waitForTimeout(3500);
  await shot(live, '11-live-scratch-idle', '1920x1080');
  await live.getByRole('button', { name: '복권 시작' }).click().catch(() => {});
  await shot(live, '12-live-scratch-board', '1920x1080');
  await live.close();

  // ── 모바일 강사 390x844
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await openAdmin(mob, sid);
  await shot(mob, '13-mobile-admin', '390x844');
  const partTab = mob.getByRole('button', { name: /참여자|인원/ }).first();
  await partTab.click().catch(() => {});
  await shot(mob, '14-mobile-participants', '390x844');
  await mob.getByRole('button', { name: '명단 관리' }).click().catch(() => {});
  await shot(mob, '15-mobile-roster', '390x844');
  await mob.close();

  // ── 학생 화면(일반 세션에서 즉석복권 진행 중)
  const sid2 = `e2e_audit_stu_${Date.now()}`;
  await put(`sessions/${sid2}`, { status: 'active', currentMode: 'scratchCard', courseName: '검수용 수업', roundNumber: 1, createdAt: Date.now() });
  await put(`sessions/${sid2}/participants`, { stu_1: { nickname: '학생A', online: true } });
  const stu = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await stu.goto(`${BASE}/?s=${sid2}`);
  await stu.evaluate(() => { localStorage.setItem('dorandoran_participant_id', 'stu_1'); localStorage.setItem('dorandoran_nickname', '학생A'); });
  await stu.reload();
  await stu.waitForTimeout(3000);
  await shot(stu, '16-student-scratch-waiting', '390x844');
  await put(`sessions/${sid2}/gameResult`, { mode: 'scratchCard', winners: [{ id: 'stu_1', nickname: '학생A', employeeId: '20260001' }], allParticipantIds: ['stu_1'], resultId: 'r1', timestamp: Date.now() });
  await stu.waitForTimeout(2000);
  await shot(stu, '17-student-scratch-win', '390x844');
  await stu.close();
  await del(`sessions/${sid2}`);

  console.log('\n=== 의심 화면 ===');
  console.log(findings.length === 0 ? '없음' : JSON.stringify(findings, null, 2));
} catch (e) {
  console.error('검수 중단:', e.message);
} finally {
  await del(`sessions/${sid}`);
  await browser.close();
}
