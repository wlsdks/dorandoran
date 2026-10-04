/**
 * 세 가지 추첨(슬롯/즉석복권/발표자 뽑기)이 전자칠판과 동기화되는지 한 번에 검증한다.
 * 왼쪽 창=강사(조작), 오른쪽 창=전자칠판(보기).
 */
import { chromium } from '@playwright/test';

const DB = 'https://jinan-6c884-default-rtdb.asia-southeast1.firebasedatabase.app';
const BASE = 'http://localhost:5173';
const OUT = '/tmp/dorandoran-mirror';
const ADMIN = { uid: 'e2e_admin_master', username: 'test_master', displayName: '테스트 강사', role: 'master' };
const sid = `e2e_mirror_${Date.now()}`;

const put = (p, d) => fetch(`${DB}/${p}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
const del = (p) => fetch(`${DB}/${p}.json`, { method: 'DELETE' });

const NAMES = ['홍길동', '김철수', '이영희', '박민수', '최지우', '강한나'];
const roster = Object.fromEntries(NAMES.map((n, i) => [
  `manual_${i}`, { nickname: n, employeeId: `2026${String(i + 1).padStart(4, '0')}`, online: true, source: 'manual', order: i },
]));

const problems = [];
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '  ✓' : '  ✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) problems.push(`${label}${detail ? ` (${detail})` : ''}`);
};

const browser = await chromium.launch({ channel: 'chrome', headless: false, slowMo: 40 });
try {
  await put(`sessions/${sid}`, { status: 'active', currentMode: 'waiting', courseName: '동기화 검증', roundNumber: 1, createdAt: Date.now(), drawOnly: true });
  await put(`sessions/${sid}/participants`, roster);

  const admin = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  await admin.goto(`${BASE}/admin`);
  await admin.evaluate((u) => sessionStorage.setItem('dorandoran_admin', JSON.stringify(u)), ADMIN);
  await admin.goto(`${BASE}/admin?s=${sid}`);
  await admin.waitForTimeout(3000);

  const live = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  await live.goto(`${BASE}/live?s=${sid}`);
  await live.waitForTimeout(2500);

  const noControls = async (label) => {
    const buttons = await live.getByRole('button').allInnerTexts();
    const operable = buttons.filter((t) => /추첨 시작|다시 추첨|복권 시작|새 판 깔기|발표자 뽑기|한 번 더|초기화|모두 긁기/.test(t));
    check(`${label}: 전자칠판에 조작 버튼 없음`, operable.length === 0, operable.join(',') || '');
    const hint = await live.getByText('강사 화면을 그대로 보여주는 중입니다').count();
    check(`${label}: 보기 전용 안내 표시`, hint > 0);
  };

  // ── 1. 슬롯 추첨
  console.log('\n[슬롯 추첨]');
  await put(`sessions/${sid}/currentMode`, 'lottery');
  await admin.waitForTimeout(1800); await live.waitForTimeout(1800);
  await noControls('슬롯');
  await admin.getByRole('button', { name: /추첨 시작/ }).click();
  await admin.waitForTimeout(1200);
  const liveRolling = await live.getByText(/두근두근|등 발표/).count();
  check('슬롯: 롤링이 전자칠판에도 보임', liveRolling > 0);
  await admin.waitForTimeout(4000); await live.waitForTimeout(1500);
  const adminLotto = await admin.getByText(/명 당첨!/).first().innerText().catch(() => '');
  const liveLotto = await live.getByText(/명 당첨!/).first().innerText().catch(() => '');
  check('슬롯: 결과가 양쪽에 동일', !!liveLotto && adminLotto === liveLotto, `${adminLotto} / ${liveLotto}`);
  const adminWinnerName = await admin.locator('.bg-slate-900.rounded-2xl').first().innerText().catch(() => '');
  const liveWinnerName = await live.locator('.bg-slate-900.rounded-2xl').first().innerText().catch(() => '');
  check('슬롯: 당첨자 이름 일치', adminWinnerName.split('\n')[0] === liveWinnerName.split('\n')[0], `${adminWinnerName.split('\n')[0]} / ${liveWinnerName.split('\n')[0]}`);
  await live.screenshot({ path: `${OUT}/mirror-lottery-live.png` });

  // ── 2. 즉석복권
  console.log('\n[즉석복권]');
  await put(`sessions/${sid}/currentMode`, 'scratchCard');
  await admin.waitForTimeout(1800); await live.waitForTimeout(1800);
  await noControls('복권');
  await admin.getByRole('button', { name: '복권 시작' }).click();
  await admin.waitForTimeout(1500);
  check('복권: 전자칠판에 같은 판이 깔림', (await live.locator('canvas').count()) === 9, `${await live.locator('canvas').count()}칸`);
  for (let i = 1; i <= 9; i += 1) {
    const cell = admin.getByRole('button', { name: `${i}번 칸 긁기` });
    if (await cell.count() === 0) break;
    await cell.click().catch(() => {});
    await admin.waitForTimeout(900);
    if (await admin.locator('.ring-amber-400').count() > 0) break;
  }
  await live.waitForTimeout(3000);
  const adminScratch = await admin.getByText(/당첨$/).first().innerText().catch(() => '');
  const liveScratch = await live.getByText(/당첨$/).first().innerText().catch(() => '');
  check('복권: 당첨자가 양쪽에 동일', !!liveScratch && adminScratch === liveScratch, `${adminScratch} / ${liveScratch}`);
  await live.screenshot({ path: `${OUT}/mirror-scratch-live.png` });

  // ── 3. 발표자 뽑기
  console.log('\n[발표자 뽑기]');
  await put(`sessions/${sid}/currentMode`, 'randomPicker');
  await admin.waitForTimeout(1800); await live.waitForTimeout(1800);
  await noControls('발표자');
  await admin.getByRole('button', { name: '발표자 뽑기' }).last().click();
  await admin.waitForTimeout(1000);
  const livePicking = await live.locator('.text-3xl.font-bold').count();
  check('발표자: 뽑는 중 화면이 전자칠판에도 보임', livePicking > 0);
  await admin.waitForTimeout(5000); await live.waitForTimeout(1500);
  const adminPick = await admin.locator('.text-4xl').first().innerText().catch(() => '');
  const livePick = await live.locator('.text-4xl').first().innerText().catch(() => '');
  check('발표자: 결과가 양쪽에 동일', !!livePick && adminPick === livePick, `${adminPick} / ${livePick}`);
  await live.screenshot({ path: `${OUT}/mirror-picker-live.png` });
  await admin.screenshot({ path: `${OUT}/mirror-picker-admin.png` });

  await live.waitForTimeout(3000);
} catch (e) {
  console.error('검증 중단:', e.message);
  problems.push(`예외: ${e.message}`);
} finally {
  await del(`sessions/${sid}`);
  await browser.close();
  console.log('\n=== 결과 ===');
  console.log(problems.length === 0 ? '전부 통과 — 세 추첨 모두 전자칠판과 동기화됨' : problems.map((p) => `- ${p}`).join('\n'));
}
