/**
 * 1) 모드 카드: 모드를 질문 목록에 넣고 눌러서 바로 전환되는가
 * 2) 발표자 뽑기: 3·2·1 카운트다운이 뜨고 흐림이 걷히며 공개되는가
 */
import { chromium } from '@playwright/test';

const DB = 'https://jinan-6c884-default-rtdb.asia-southeast1.firebasedatabase.app';
const BASE = 'http://localhost:5173';
const OUT = '/tmp/dorandoran-modecard';
const ADMIN = { uid: 'e2e_admin_master', username: 'test_master', displayName: '테스트 강사', role: 'master' };
const sid = `e2e_mc_${Date.now()}`;

const put = (p, d) => fetch(`${DB}/${p}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
const get = (p) => fetch(`${DB}/${p}.json`).then((r) => r.json());
const del = (p) => fetch(`${DB}/${p}.json`, { method: 'DELETE' });

const problems = [];
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) problems.push(`${label}${detail ? ` — ${detail}` : ''}`);
};

const roster = Object.fromEntries(['홍길동','김철수','이영희','박민수','최지우','강한나'].map((n,i)=>[
  `m${i}`, { nickname: n, employeeId: `2026000${i+1}`, online: true, source: 'manual', order: i },
]));

const browser = await chromium.launch({ channel: 'chrome', headless: false, slowMo: 45 });
try {
  await put(`sessions/${sid}`, { status: 'active', currentMode: 'waiting', courseName: '모드 카드 확인', roundNumber: 1, createdAt: Date.now(), drawOnly: true });
  await put(`sessions/${sid}/participants`, roster);

  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(`${BASE}/admin`);
  await page.evaluate((u) => {
    sessionStorage.setItem('dorandoran_admin', JSON.stringify(u));
    localStorage.setItem('dorandoran_draw_display', 'name');
  }, ADMIN);
  await page.goto(`${BASE}/admin?s=${sid}`);
  await page.waitForTimeout(3500);

  // ── 1. 모드 메뉴에서 목록에 추가
  console.log('\n[모드 카드]');
  await page.getByRole('button', { name: '모드', exact: true }).click();
  await page.waitForTimeout(700);
  const addButtons = await page.getByRole('button', { name: /질문 목록에 추가/ }).count();
  check('모드마다 목록 추가 버튼이 있다', addButtons >= 10, `${addButtons}개`);
  await page.screenshot({ path: `${OUT}/1-mode-menu.png` });

  await page.getByRole('button', { name: /즉석복권을\(를\) 질문 목록에 추가/ }).click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: '모드', exact: true }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /쉬는 시간을\(를\) 질문 목록에 추가/ }).click();
  await page.waitForTimeout(1800);

  const saved = Object.values(await get(`sessions/${sid}/questions`) || {});
  const cards = saved.filter((q) => q.type === 'modeCard');
  check('모드 카드가 목록에 저장된다', cards.length === 2, cards.map((c) => `${c.mode}:${c.title}`).join(', '));
  check('순서가 부여된다', cards.every((c) => typeof c.order === 'number'));

  check('목록에 화면 전환 항목으로 보인다', await page.getByText('즉석복권 화면').count() > 0);
  await page.screenshot({ path: `${OUT}/2-list-with-cards.png` });
  const cardsSaved = cards.length === 2;
  if (!cardsSaved) console.log('    (DB 규칙 미배포 상태에서는 모드 카드 저장이 거부됩니다 — 전환 검증 건너뜀)');

  // ── 2. 눌러서 바로 전환
  if (cardsSaved) {
    // 목록의 '즉석복권 화면' 행에 있는 활성화 버튼을 정확히 누른다
    // 모바일용 버튼은 데스크톱에서 0x0으로 숨어 있다 — 실제로 보이는 버튼만 누른다
    await page.locator('[aria-label="이 화면으로 전환"]:visible').first().click();
    await page.waitForTimeout(2000);
    const mode = await get(`sessions/${sid}/currentMode`);
    check('카드를 누르면 그 모드로 바뀐다', mode === 'scratchCard', `currentMode=${mode}`);
    check('복권 화면이 떴다', await page.getByRole('button', { name: '복권 시작하기' }).count() > 0);
    await page.screenshot({ path: `${OUT}/3-mode-activated.png` });
  }

  // ── 3. 발표자 뽑기 카운트다운
  console.log('\n[발표자 뽑기 연출]');
  await put(`sessions/${sid}/currentMode`, 'randomPicker');
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: '발표자 뽑기' }).last().click();

  // 1.5초 회전 뒤 3 → 2 → 1
  const seen = [];
  for (let i = 0; i < 60; i += 1) {
    await page.waitForTimeout(90);
    // 전환 중에는 나가는 노드와 들어오는 노드가 잠시 함께 있다 — 전부 훑는다
    const texts = (await page.locator('.text-6xl').allInnerTexts().catch(() => []))
      .map((t) => t.trim()).filter(Boolean);
    for (const t of texts) if (!seen.includes(t)) seen.push(t);
  }
  check('3·2·1 카운트다운이 뜬다', ['3', '2', '1'].every((n) => seen.includes(n)), `본 숫자: ${seen.join(' → ') || '없음'}`);
  await page.waitForTimeout(1500);
  const picked = (await page.locator('p.text-4xl').first().innerText().catch(() => '')).trim();
  check('카운트다운 뒤 발표자가 공개된다', picked.length > 0, picked);
  await page.screenshot({ path: `${OUT}/4-picker-revealed.png` });
  await page.waitForTimeout(1500);
} catch (e) {
  console.error('중단:', e.message);
  problems.push(`예외: ${e.message}`);
} finally {
  await del(`sessions/${sid}`);
  await browser.close();
  console.log('\n=== 결과 ===');
  console.log(problems.length === 0 ? '모드 카드 · 카운트다운 정상' : problems.map((p) => `- ${p}`).join('\n'));
}
