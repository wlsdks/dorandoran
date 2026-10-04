/**
 * 발표 모드 개선 검증.
 * 1) 대시보드와 발표 모드의 모드 목록이 같은가
 * 2) 웹페이지 슬라이드가 발표/전자칠판/학생에서 각각 맞게 나오는가
 * 3) 임베드를 거부하는 사이트를 새 창 안내로 바꾸는가
 */
import { chromium } from '@playwright/test';

const DB = 'https://jinan-6c884-default-rtdb.asia-southeast1.firebasedatabase.app';
const BASE = 'http://localhost:5173';
const OUT = '/tmp/dorandoran-present';
const ADMIN = { uid: 'e2e_admin_master', username: 'test_master', displayName: '테스트 강사', role: 'master' };
const sid = `e2e_present_${Date.now()}`;

const put = (p, d) => fetch(`${DB}/${p}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
const del = (p) => fetch(`${DB}/${p}.json`, { method: 'DELETE' });

const problems = [];
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) problems.push(`${label}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({ channel: 'chrome', headless: false, slowMo: 50 });
try {
  await put(`sessions/${sid}`, {
    status: 'active', currentMode: 'poll', courseName: '발표 모드 검증', roundNumber: 1, createdAt: Date.now(),
    currentQuestion: 'q_embed',
    questions: {
      q_embed: { title: '오늘 실습할 문서', type: 'webEmbed', embedUrl: 'https://example.com/', order: 0, activatedAt: Date.now() },
      q_blocked: { title: '임베드 거부 사이트', type: 'webEmbed', embedUrl: 'https://github.com/', order: 1 },
    },
  });
  await put(`sessions/${sid}/participants`, { stu_1: { nickname: '학생A', online: true } });

  const admin = await browser.newPage({ viewport: { width: 1400, height: 880 } });
  await admin.goto(`${BASE}/admin`);
  await admin.evaluate((u) => sessionStorage.setItem('dorandoran_admin', JSON.stringify(u)), ADMIN);
  await admin.goto(`${BASE}/admin?s=${sid}`);
  await admin.waitForTimeout(3500);

  // ── 1. 대시보드 모드 목록
  await admin.getByRole('button', { name: '모드', exact: true }).click();
  await admin.waitForTimeout(600);
  const dashModes = (await admin.locator('[class*="absolute"] button').allInnerTexts())
    .map((t) => t.trim()).filter(Boolean);
  await admin.keyboard.press('Escape');
  await admin.evaluate(() => document.body.click());
  await admin.waitForTimeout(400);

  // ── 2. 웹페이지 슬라이드 (대시보드 중앙)
  check('웹페이지 슬라이드가 강사 화면에 렌더', await admin.locator('iframe').count() > 0, `${await admin.locator('iframe').count()}개`);
  await admin.waitForTimeout(3000);
  await admin.screenshot({ path: `${OUT}/admin-embed.png` });

  // ── 3. 발표 모드 진입 후 모드 목록 비교
  await admin.getByRole('button', { name: /발표 모드/ }).click();
  await admin.waitForTimeout(2500);
  await admin.screenshot({ path: `${OUT}/present-embed.png` });

  await admin.getByRole('button', { name: '모드', exact: true }).click();
  await admin.waitForTimeout(600);
  const presentModes = (await admin.locator('[class*="absolute"] button').allInnerTexts())
    .map((t) => t.trim()).filter(Boolean);
  await admin.screenshot({ path: `${OUT}/present-mode-menu.png` });

  const wanted = ['추첨', '즉석복권', '발표자 뽑기', '이해도 체크', '빠른 설문', '그룹 토론', '집중!'];
  const missing = wanted.filter((w) => !presentModes.some((m) => m.includes(w)));
  check('발표 모드에서 모든 모드를 켤 수 있다', missing.length === 0, missing.join(', ') || '누락 없음');
  console.log(`    대시보드 ${dashModes.length}개 / 발표모드 ${presentModes.length}개`);

  await admin.keyboard.press('Escape');
  await admin.waitForTimeout(1500);

  // ── 4. 전자칠판
  const live = await browser.newPage({ viewport: { width: 1400, height: 880 } });
  await live.goto(`${BASE}/live?s=${sid}`);
  await live.waitForTimeout(4000);
  check('전자칠판에도 웹페이지가 나온다', await live.locator('iframe').count() > 0);
  await live.screenshot({ path: `${OUT}/live-embed.png` });
  await live.close();

  // ── 5. 학생 폰 — iframe 대신 열기 버튼
  const stu = await browser.newPage({ viewport: { width: 380, height: 780 }, isMobile: true, hasTouch: true });
  await stu.goto(`${BASE}/?s=${sid}`);
  await stu.waitForTimeout(1200);
  await stu.getByRole('textbox').first().fill('학생A');
  await stu.getByRole('button', { name: /참여하기/ }).click();
  await stu.waitForTimeout(3000);
  check('학생 폰에는 iframe을 띄우지 않는다', await stu.locator('iframe').count() === 0);
  check('학생 폰에 열기 버튼이 있다', await stu.getByText('내 폰에서 열기').count() > 0);
  await stu.screenshot({ path: `${OUT}/student-embed.png` });
  await stu.close();

  // ── 6. 임베드를 거부하는 사이트 → 새 창 안내
  await put(`sessions/${sid}/currentQuestion`, 'q_blocked');
  await put(`sessions/${sid}/questions/q_blocked/activatedAt`, Date.now());
  await admin.waitForTimeout(9000); // 로드 타임아웃(6초)보다 넉넉히
  const blockedNotice = await admin.getByText('이 사이트는 화면 안에서 열 수 없어요').count();
  check('임베드 거부 사이트를 새 창 안내로 바꾼다', blockedNotice > 0);
  check('새 창 버튼 제공', await admin.getByRole('button', { name: '새 창에서 열기' }).count() > 0);
  await admin.screenshot({ path: `${OUT}/present-blocked.png` });
  await admin.waitForTimeout(2000);
} catch (e) {
  console.error('중단:', e.message);
  problems.push(`예외: ${e.message}`);
} finally {
  await del(`sessions/${sid}`);
  await browser.close();
  console.log('\n=== 결과 ===');
  console.log(problems.length === 0 ? '발표 모드 개선 전부 통과' : problems.map((p) => `- ${p}`).join('\n'));
}
