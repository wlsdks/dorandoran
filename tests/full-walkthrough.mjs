/**
 * 전체 흐름 시연 및 검증.
 * 새 클래스 등록 → 명단 입력 → 즉석복권 추첨 → 전자칠판 동기화 → 학생 입장 차단까지
 * 사람이 보는 속도로 진행하며 각 단계를 캡처한다.
 */
import { chromium } from '@playwright/test';

const DB = 'https://jinan-6c884-default-rtdb.asia-southeast1.firebasedatabase.app';
const BASE = 'http://localhost:5173';
const OUT = '/tmp/dorandoran-walk';
const ADMIN = { uid: 'e2e_admin_master', username: 'test_master', displayName: '테스트 강사', role: 'master' };

const get = (p) => fetch(`${DB}/${p}.json`).then((r) => r.json());
const del = (p) => fetch(`${DB}/${p}.json`, { method: 'DELETE' });

const problems = [];
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '  ✓' : '  ✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) problems.push(`${label}${detail ? ` — ${detail}` : ''}`);
};

let step = 0;
async function say(page, text, ms = 1800) {
  await page.evaluate((t) => {
    let el = document.getElementById('__walk_caption');
    if (!el) {
      el = document.createElement('div');
      el.id = '__walk_caption';
      el.style.cssText = 'position:fixed;bottom:14px;left:14px;z-index:2147483647;background:rgba(15,23,42,.92);color:#fff;font:600 13px Pretendard,system-ui,sans-serif;padding:8px 14px;border-radius:999px;pointer-events:none;max-width:60vw';
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text).catch(() => {});
  await page.waitForTimeout(ms);
}
async function shot(page, name) {
  step += 1;
  await page.screenshot({ path: `${OUT}/${String(step).padStart(2, '0')}-${name}.png` });
}

const browser = await chromium.launch({ channel: 'chrome', headless: false, slowMo: 90 });
let sessionId = null;
try {
  const admin = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // ── 1. 강사 계정으로 대시보드 진입
  await admin.goto(`${BASE}/admin`);
  await admin.evaluate((u) => sessionStorage.setItem('dorandoran_admin', JSON.stringify(u)), ADMIN);
  await admin.goto(`${BASE}/admin`);
  await admin.waitForTimeout(2500);
  await say(admin, '① 강사 계정으로 대시보드 진입', 2000);
  await shot(admin, 'dashboard');

  // ── 2. 새 클래스 만들기
  await admin.getByRole('button', { name: /새 클래스/ }).first().click();
  await admin.waitForTimeout(900);
  await say(admin, '② 새 클래스 만들기. 강의를 고릅니다', 2200);
  await shot(admin, 'course-picker');

  // 기존 강의 중 하나를 고른다(새 강의를 만들면 지울 수 없는 항목이 계속 쌓인다).
  // 목록이 비동기로 채워지므로 렌더가 끝난 뒤에 클릭하고, 확인 단계가 뜰 때까지 기다린다.
  await admin.locator('[role="dialog"] button').first().waitFor({ timeout: 15000 });
  await admin.waitForTimeout(1200);
  let picked = false;
  for (let attempt = 0; attempt < 3 && !picked; attempt += 1) {
    const rows = admin.locator('[role="dialog"] button');
    const total = await rows.count();
    for (let i = 0; i < total; i += 1) {
      const label = (await rows.nth(i).innerText().catch(() => '')).trim();
      if (!label || /새 강의|닫기|취소/.test(label)) continue;
      await rows.nth(i).scrollIntoViewIfNeeded().catch(() => {});
      await rows.nth(i).click().catch(() => {});
      const reached = await admin.getByText('클래스 확인').waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
      if (reached) {
        console.log(`  선택한 강의: ${label.split('\n')[0]}`);
        picked = true;
      }
      break;
    }
  }
  check('강의 선택', picked);
  await admin.waitForTimeout(1200);

  // ── 3. 추첨 전용 모드 켜고 등록
  await say(admin, '③ 확인 단계에서 추첨 전용 모드를 켭니다', 2600);
  await shot(admin, 'confirm-step');
  const drawToggle = admin.getByRole('switch', { name: /추첨 전용 모드/ });
  check('추첨 전용 모드 토글 노출', await drawToggle.count() > 0);
  await drawToggle.click();
  await admin.waitForTimeout(600);
  check('토글 켜짐', (await drawToggle.getAttribute('aria-checked')) === 'true');
  await shot(admin, 'draw-only-on');

  await say(admin, '④ 클래스 등록', 1500);
  await admin.getByRole('button', { name: /클래스 등록/ }).click();
  await admin.waitForTimeout(4000);

  sessionId = await admin.evaluate(() => new URLSearchParams(location.search).get('s'));
  console.log(`  생성된 세션: ${sessionId}`);
  check('세션 생성됨', !!sessionId);
  const created = await get(`sessions/${sessionId}`);
  check('drawOnly가 DB에 기록됨', created?.drawOnly === true, JSON.stringify(created?.drawOnly));

  await say(admin, '⑤ QR 대신 명단 관리가 놓입니다', 2800);
  await shot(admin, 'session-created');
  check('QR 대신 명단 관리 노출', await admin.getByRole('button', { name: '명단 관리' }).count() > 0);
  check('초대 QR 숨김', await admin.getByRole('button', { name: /초대 링크 복사/ }).count() === 0);

  // ── 4. 명단 입력
  await admin.getByRole('button', { name: '명단 관리' }).click();
  await admin.waitForTimeout(900);
  await say(admin, '⑥ 엑셀에서 긁은 명단을 붙여넣습니다', 2400);
  await shot(admin, 'roster-empty');

  await admin.evaluate(() => {
    const input = document.querySelector('input[aria-label="1번 이름"]');
    const dt = new DataTransfer();
    dt.setData('text', '홍길동\t20260001\n김철수\t20260002\n이영희\t20260003\n박민수\t20260004\n최지우\t20260005\n강한나\t20260006');
    input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await admin.waitForTimeout(1200);
  await say(admin, '⑦ 6명이 한 번에 들어왔습니다. 수정·삭제·추가도 여기서', 2600);
  await shot(admin, 'roster-pasted');

  await admin.getByRole('button', { name: '행 추가' }).click();
  await admin.locator('input[aria-label="7번 이름"]').fill('정우성');
  await admin.locator('input[aria-label="7번 사번"]').fill('20260007');
  await admin.locator('input[aria-label="2번 사번"]').fill('20269999');
  await admin.getByRole('button', { name: '3번 삭제' }).click();
  await admin.waitForTimeout(800);
  await say(admin, '⑧ 직접 추가 1명, 사번 수정 1건, 삭제 1건', 2400);
  await shot(admin, 'roster-edited');

  await admin.getByRole('button', { name: '저장하기' }).click();
  await admin.waitForTimeout(3000);
  const saved = await get(`sessions/${sessionId}/participants`);
  const rows = Object.values(saved || {}).filter((p) => p.source === 'manual');
  check('명단 저장', rows.length === 6, `${rows.length}명`);
  check('수정한 사번 반영', rows.some((r) => r.employeeId === '20269999'));
  check('삭제한 사람 제외', !rows.some((r) => r.nickname === '이영희'));
  const joinToast = await admin.getByText('입장했어요').count();
  check("명단 추가에 '입장했어요' 토스트 없음", joinToast === 0, `${joinToast}건`);
  check('인원 라벨이 명단으로 표시', await admin.getByText(/명단 6/).count() > 0);
  await say(admin, '⑨ 저장 완료. 6명이 추첨 대상이 되었습니다', 2400);
  await shot(admin, 'roster-saved');

  // ── 5. 전자칠판 열기
  const live = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await live.goto(`${BASE}/live?s=${sessionId}`);
  await live.waitForTimeout(3000);
  await say(live, '⑩ 전자칠판 화면입니다. 조작 버튼이 없습니다', 2600);
  await shot(live, 'live-waiting');

  // ── 6. 즉석복권
  await admin.bringToFront();
  await admin.getByRole('button', { name: '모드', exact: true }).click();
  await admin.waitForTimeout(800);
  await admin.getByRole('button', { name: '즉석복권' }).click();
  await admin.waitForTimeout(2500);
  await say(admin, '⑪ 모드를 즉석복권으로 바꿉니다', 2200);
  await shot(admin, 'scratch-idle');
  await live.waitForTimeout(1500);
  await shot(live, 'live-scratch-idle');

  await admin.getByRole('button', { name: '복권 시작' }).click();
  await admin.waitForTimeout(1500);
  await say(admin, '⑫ 판이 깔렸습니다. 전자칠판에도 같은 판이 깔립니다', 2400);
  await shot(admin, 'scratch-board');
  check('전자칠판에 같은 판', await live.locator('canvas').count() === 9, `${await live.locator('canvas').count()}칸`);
  await shot(live, 'live-scratch-board');

  for (let i = 1; i <= 9; i += 1) {
    const cell = admin.getByRole('button', { name: `${i}번 칸 긁기` });
    if (await cell.count() === 0) break;
    await cell.click().catch(() => {});
    await admin.waitForTimeout(1000);
    if (await admin.locator('.ring-amber-400').count() > 0) break;
  }
  await admin.waitForTimeout(1200);
  await live.waitForTimeout(2500);
  const adminWin = await admin.getByText(/당첨$/).first().innerText().catch(() => '');
  const liveWin = await live.getByText(/당첨$/).first().innerText().catch(() => '');
  check('당첨자 양쪽 동일', !!liveWin && adminWin === liveWin, `${adminWin} / ${liveWin}`);
  await say(admin, `⑬ ${adminWin} 전자칠판에도 같은 당첨자가 떴습니다`, 2800);
  await shot(admin, 'scratch-win');
  await shot(live, 'live-scratch-win');

  // ── 7. 사번 보기 전환
  await admin.getByRole('radio', { name: '사번 보기' }).click();
  await admin.waitForTimeout(1200);
  await say(admin, '⑭ 사번 보기로 전환하면 사번이 앞으로 나옵니다', 2600);
  await shot(admin, 'employee-view');

  // ── 8. 학생 입장 차단
  const student = await browser.newPage({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
  await student.goto(`${BASE}/?s=${sessionId}`);
  await student.waitForTimeout(2500);
  const blocked = await student.getByText('추첨 전용 세션이에요').count();
  check('학생 입장 차단', blocked > 0);
  await say(student, '⑮ 학생이 링크로 들어와도 입장이 막힙니다', 2600);
  await shot(student, 'student-blocked');

  await admin.bringToFront();
  await say(admin, '검증 완료. 잠시 후 데모 세션은 삭제됩니다', 8000);
} catch (e) {
  console.error('중단:', e.message);
  problems.push(`예외: ${e.message}`);
} finally {
  if (sessionId) await del(`sessions/${sessionId}`);
  await browser.close();
  console.log('\n=== 결과 ===');
  console.log(problems.length === 0 ? '전 과정 통과' : problems.map((p) => `- ${p}`).join('\n'));
  console.log(sessionId ? `데모 세션 ${sessionId} 삭제 완료` : '');
}
