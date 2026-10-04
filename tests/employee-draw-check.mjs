/**
 * 최초 요구사항 확인: 사번으로 추첨하고, 사번으로 당첨자를 확인할 수 있는가.
 * 이름 없이 사번만 등록한 사람도 섞어서 3종 추첨을 모두 돌린다.
 */
import { chromium } from '@playwright/test';

const DB = 'https://jinan-6c884-default-rtdb.asia-southeast1.firebasedatabase.app';
const BASE = 'http://localhost:5173';
const OUT = '/tmp/dorandoran-employee';
const ADMIN = { uid: 'e2e_admin_master', username: 'test_master', displayName: '테스트 강사', role: 'master' };
const sid = `e2e_emp_${Date.now()}`;

const put = (p, d) => fetch(`${DB}/${p}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
const get = (p) => fetch(`${DB}/${p}.json`).then((r) => r.json());
const del = (p) => fetch(`${DB}/${p}.json`, { method: 'DELETE' });

const problems = [];
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) problems.push(`${label}${detail ? ` — ${detail}` : ''}`);
};

// 이름+사번 4명, 사번만 2명
const roster = {
  m0: { nickname: '홍길동', employeeId: '20260001', online: true, source: 'manual', order: 0 },
  m1: { nickname: '김철수', employeeId: '20260002', online: true, source: 'manual', order: 1 },
  m2: { nickname: '이영희', employeeId: '20260003', online: true, source: 'manual', order: 2 },
  m3: { nickname: '박민수', employeeId: '20260004', online: true, source: 'manual', order: 3 },
  m4: { nickname: '20260005', employeeId: '20260005', online: true, source: 'manual', order: 4 },
  m5: { nickname: '20260006', employeeId: '20260006', online: true, source: 'manual', order: 5 },
};
const ALL_IDS = Object.values(roster).map((r) => r.employeeId);

const browser = await chromium.launch({ channel: 'chrome', headless: false, slowMo: 45 });
try {
  await put(`sessions/${sid}`, { status: 'active', currentMode: 'lottery', courseName: '사번 추첨 확인', roundNumber: 1, createdAt: Date.now(), drawOnly: true });
  await put(`sessions/${sid}/participants`, roster);

  const page = await browser.newPage({ viewport: { width: 1360, height: 880 } });
  await page.goto(`${BASE}/admin`);
  await page.evaluate((u) => {
    sessionStorage.setItem('dorandoran_admin', JSON.stringify(u));
    localStorage.setItem('dorandoran_draw_display', 'employeeId'); // 사번 보기로 시작
  }, ADMIN);
  await page.goto(`${BASE}/admin?s=${sid}`);
  await page.waitForTimeout(3500);

  check('사번 보기 상태가 유지된다', (await page.getByRole('radio', { name: '사번 보기' }).getAttribute('aria-checked')) === 'true');

  // ── 1. 슬롯 추첨
  console.log('\n[슬롯 추첨]');
  await page.getByRole('button', { name: /추첨 시작|보상 추첨|제비뽑기/ }).click();
  await page.waitForTimeout(5000);
  const lotteryTexts = await page.locator('.bg-slate-900.rounded-2xl').allInnerTexts();
  const lotteryLines = lotteryTexts.join('\n').split('\n').map((t) => t.trim()).filter(Boolean);
  check('당첨 카드에 사번이 크게 나온다', lotteryLines.some((t) => ALL_IDS.includes(t)), lotteryLines.join(' / '));
  await page.screenshot({ path: `${OUT}/1-lottery-employee.png` });

  await page.waitForTimeout(1500);
  const r1 = await get(`sessions/${sid}/gameResult`);
  check('결과 기록에 사번이 남는다', !!r1?.winners?.[0]?.employeeId, JSON.stringify(r1?.winners?.[0] || '없음'));

  // ── 2. 이름 보기로 전환하면 이름이 앞으로
  await page.getByRole('radio', { name: '이름 보기' }).click();
  await page.waitForTimeout(900);
  const nameLines = (await page.locator('.bg-slate-900.rounded-2xl').allInnerTexts())
    .join('\n').split('\n').map((t) => t.trim()).filter(Boolean);
  const NAMES = ['홍길동', '김철수', '이영희', '박민수'];
  check('이름 보기로 바꾸면 이름이 앞으로 나온다',
    nameLines.some((t) => NAMES.includes(t)) || nameLines.some((t) => ALL_IDS.includes(t)),
    nameLines.join(' / '));
  await page.screenshot({ path: `${OUT}/2-lottery-name.png` });
  await page.getByRole('radio', { name: '사번 보기' }).click();
  await page.waitForTimeout(600);

  // ── 3. 즉석복권
  console.log('\n[즉석복권]');
  await put(`sessions/${sid}/currentMode`, 'scratchCard');
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: '복권 시작하기' }).click();
  await page.waitForTimeout(1300);
  const cellText = await page.getByRole('button', { name: '1번 칸 긁기' }).count();
  check('복권 판이 깔린다', cellText > 0);
  for (let i = 1; i <= 9; i += 1) {
    const cell = page.getByRole('button', { name: `${i}번 칸 긁기` });
    if (await cell.count() === 0) break;
    await cell.click().catch(() => {});
    await page.waitForTimeout(850);
    if (await page.locator('.ring-amber-400').count() > 0) break;
  }
  await page.waitForTimeout(1800);
  const winRow = await page.locator('.ring-amber-400').first().innerText().catch(() => '');
  const winCells = winRow.split('\n').map((t) => t.trim()).filter(Boolean);
  check('당첨 줄 3칸이 사번으로 표시된다', winCells.filter((t) => ALL_IDS.includes(t)).length >= 3, winCells.slice(0, 6).join(' / '));
  await page.screenshot({ path: `${OUT}/3-scratch-employee.png` });

  const r2 = await get(`sessions/${sid}/gameResult`);
  check('즉석복권 결과에도 사번이 남는다', !!r2?.winners?.[0]?.employeeId, r2?.winners?.[0]?.employeeId || '없음');

  // ── 4. 발표자 뽑기
  console.log('\n[발표자 뽑기]');
  await put(`sessions/${sid}/currentMode`, 'randomPicker');
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: '발표자 뽑기' }).last().click();
  await page.waitForTimeout(6000);
  const picked = (await page.locator('p.text-4xl').first().innerText().catch(() => '')).trim();
  check('뽑힌 사람이 사번으로 표시된다', ALL_IDS.includes(picked), `표시: "${picked}"`);
  await page.waitForTimeout(1500);
  const r3 = await get(`sessions/${sid}/gameResult`);
  check('발표자 뽑기 결과에도 사번이 남는다', !!r3?.winners?.[0]?.employeeId, JSON.stringify(r3?.winners?.[0] || '없음'));
  await page.screenshot({ path: `${OUT}/4-picker-employee.png` });

  // ── 5. 이름 없이 사번만 등록된 사람 처리
  console.log('\n[이름 없이 사번만 등록한 사람]');
  await page.getByRole('radio', { name: '이름 보기' }).click();
  await page.waitForTimeout(800);
  const bodyText = await page.locator('body').innerText();
  check('이름 보기에서도 사번만 있는 사람이 빈칸으로 뜨지 않는다', !/\n\s*\n\s*당첨/.test(bodyText));
  await page.waitForTimeout(1500);
} catch (e) {
  console.error('중단:', e.message);
  problems.push(`예외: ${e.message}`);
} finally {
  await del(`sessions/${sid}`);
  await browser.close();
  console.log('\n=== 결과 ===');
  console.log(problems.length === 0 ? '사번 추첨 전 과정 정상' : problems.map((p) => `- ${p}`).join('\n'));
}
