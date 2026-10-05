const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium, webkit, expect } = require('@playwright/test');

if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000'
  || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('Local demo emulators required');
const deps = require('node:module').createRequire(path.resolve(__dirname, '../../functions/package.json'));
const { initializeApp, deleteApp } = deps('firebase-admin/app');
const { getDatabase } = deps('firebase-admin/database');
const { getAuth } = deps('firebase-admin/auth');
const app = initializeApp({ projectId: 'demo-dorandoran', databaseURL: 'https://demo-dorandoran.firebaseio.com' });
const db = getDatabase(app);
const sid = `qa_highlight_regression_${process.pid}`;
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5175';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error('Loopback QA origin required');
const artifacts = path.join(process.env.QA_ARTIFACT_DIR || os.tmpdir(), `dorandoran-highlight-${process.pid}`);
fs.mkdirSync(artifacts, { recursive: true });
const report = { checks: [], errors: [], modelRequests: [], screenshots: [] };
const anonymousUsers = new Set();
let chrome, safari;

function save() { fs.writeFileSync(path.join(artifacts, 'manifest.json'), JSON.stringify(report, null, 2)); }
async function shot(page, file) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(artifacts, file) });
  report.screenshots.push(file);
  save();
}
async function rememberAnonymous(page) {
  const uid = await page.evaluate(async () => {
    const { auth } = await import('/src/lib/auth-session.js');
    return auth.currentUser?.isAnonymous ? auth.currentUser.uid : null;
  });
  if (uid) anonymousUsers.add(uid);
  return uid;
}
async function join(page, nickname) {
  await page.goto(`${base}/?s=${sid}`);
  await page.getByPlaceholder('닉네임 입력').fill(nickname);
  await page.getByRole('button', { name: '참여하기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '현재 리더보드', exact: true })).toBeVisible();
  return rememberAnonymous(page);
}
async function selectRanks(teacher, text) {
  await teacher.getByRole('button', { name: '강조 순위 설정', exact: true }).click();
  const dialog = teacher.getByRole('dialog', { name: '강조 순위 설정', exact: true });
  await dialog.getByLabel('강조할 순위', { exact: true }).fill(text);
  await dialog.getByRole('button', { name: '강조하기', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}
async function verifyRank(rank, teacher, wall, large, phones, first = false) {
  if (!first) await teacher.getByRole('button', { name: '다음 강조', exact: true }).click();
  await expect.poll(async () => (await db.ref(`sessions/${sid}/leaderboardHighlight/activeRank`).get()).val()).toBe(rank);
  const row = `[data-ranking-featured="true"][data-rank="${rank}"]`;
  for (const page of [wall, large]) {
    await expect(page.locator(row)).toBeVisible();
    await expect(page.getByLabel('리더보드 페이지 위치', { exact: true })).toHaveText(`${Math.floor((rank - 1) / 8) + 1} / 25`);
  }
  for (const phone of phones) {
    // Different browser engines can receive the shared metadata on different
    // frames. Wait for the current selection, not the previous strip/button.
    await expect.poll(async () => {
      if (await phone.locator(row).count()) return true;
      const strip = phone.locator('[aria-label="현재 강조 순위"]');
      return await strip.count() ? (await strip.innerText()).includes(`${rank}위`) : false;
    }).toBe(true);
    const jump = phone.getByRole('button', { name: '현재 강조 순위 보기', exact: true });
    if (await jump.count()) await jump.click();
    await expect(phone.locator(row)).toBeVisible();
  }
}

(async () => {
  const started = Date.now();
  try {
    const scores = Object.fromEntries(Array.from({ length: 200 }, (_, index) => [`h_${index}`, { nickname: `강조${String(index + 1).padStart(3, '0')}`, total: 2000 - index * 5 }]));
    const intro = { type: 'choice', title: '독립 강조 회귀', options: ['A', 'B'], order: 0 };
    await db.ref(`sessions/${sid}`).set({ creatorId: 'legacy_master', courseId: 'course_a', courseName: '독립 강조 회귀',
      createdAt: Date.now(), status: 'active', currentMode: 'leaderboard', leaderboardPage: 0,
      questions: { intro }, publicQuestions: { intro }, scores, aiEnabled: false });
    chrome = await chromium.launch(process.platform === 'darwin' ? { channel: 'chrome' } : {});
    safari = await webkit.launch();
    const controller = await chrome.newContext({ viewport: { width: 1366, height: 768 } });
    const wallContext = await chrome.newContext({ viewport: { width: 1366, height: 768 } });
    const largeContext = await chrome.newContext({ viewport: { width: 3840, height: 2160 } });
    const smallContext = await chrome.newContext({ viewport: { width: 320, height: 844 }, isMobile: true, hasTouch: true });
    const iosContext = await safari.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    for (const context of [controller, wallContext, largeContext, smallContext, iosContext]) await context.route('**/api/gemini/**', route => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.endsWith('/status')) return route.continue();
      report.modelRequests.push(pathname);
      return route.abort();
    });
    const teacher = await controller.newPage(), wall = await wallContext.newPage(), large = await largeContext.newPage();
    const small = await smallContext.newPage(), ios = await iosContext.newPage();
    const pages = [teacher, wall, large, small, ios];
    for (const page of pages) { page.setDefaultTimeout(10000); page.on('pageerror', error => report.errors.push(error.message)); }
    await teacher.goto(`${base}/admin?s=${sid}`);
    await teacher.getByPlaceholder('아이디').fill('qa-master');
    await teacher.getByPlaceholder('비밀번호').fill('TestFixture-Only-Strong8');
    await teacher.getByRole('button', { name: '로그인', exact: true }).click();
    await expect(teacher.getByRole('button', { name: '발표 모드', exact: true })).toBeVisible();
    await teacher.getByRole('button', { name: '발표 모드', exact: true }).click();
    await wall.goto(`${base}/live?s=${sid}`);
    await large.goto(`${base}/live?s=${sid}`);
    await expect(wall.getByText('강조001', { exact: true })).toBeVisible();
    await expect(large.getByText('강조001', { exact: true })).toBeVisible();
    await rememberAnonymous(wall); await rememberAnonymous(large);
    const smallUid = await join(small, '강조폰320'), iosUid = await join(ios, '강조폰390');
    await db.ref(`sessions/${sid}/scores`).update({ h_50: null, [smallUid]: { nickname: '강조폰320', total: 1750 }, h_150: null, [iosUid]: { nickname: '강조폰390', total: 1250 } });

    await teacher.getByRole('button', { name: '강조 순위 설정', exact: true }).click();
    const dialog = teacher.getByRole('dialog', { name: '강조 순위 설정', exact: true });
    for (const text of ['0, x', '1 2 3 4 5 6 7 8 9 10 11']) {
      await dialog.getByLabel('강조할 순위', { exact: true }).fill(text);
      await dialog.getByRole('button', { name: '강조하기', exact: true }).click();
      await expect(dialog.getByRole('alert')).toBeVisible();
      expect((await db.ref(`sessions/${sid}/leaderboardHighlight`).get()).val()).toBeNull();
    }
    await dialog.getByLabel('강조할 순위', { exact: true }).fill('1, 1 3, 10');
    await dialog.getByRole('button', { name: '강조하기', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect.poll(async () => (await db.ref(`sessions/${sid}/leaderboardHighlight/ranks`).get()).val()).toEqual([1, 3, 10]);
    await verifyRank(1, teacher, wall, large, [small, ios], true);
    for (const page of [wall, large, small, ios]) {
      await page.getByRole('button', { name: '다음 랭킹 페이지', exact: true }).click();
      await page.getByRole('button', { name: '다음 랭킹 페이지', exact: true }).click();
      await expect(page.getByLabel('리더보드 페이지 위치', { exact: true })).toHaveText('3 / 25');
    }
    await db.ref(`sessions/${sid}/scores/h_extra`).set({ nickname: '인원변경 확인', total: -5 });
    for (const page of [wall, large, small, ios]) await expect(page.getByLabel('리더보드 페이지 위치', { exact: true })).toHaveText('3 / 26');
    await db.ref(`sessions/${sid}/scores/h_extra`).remove();
    for (const page of [wall, large, small, ios]) await expect(page.getByLabel('리더보드 페이지 위치', { exact: true })).toHaveText('3 / 25');
    await teacher.getByRole('button', { name: '다음 강조', exact: true }).click();
    await expect.poll(async () => (await db.ref(`sessions/${sid}/leaderboardHighlight/activeRank`).get()).val()).toBe(3);
    expect((await db.ref(`sessions/${sid}/leaderboardPage`).get()).val()).toBe(0);
    for (const page of [wall, large]) {
      await expect(page.locator('[data-ranking-featured="true"][data-rank="3"]')).toBeVisible();
      await expect(page.getByLabel('리더보드 페이지 위치', { exact: true })).toHaveText('1 / 25');
    }
    for (const phone of [small, ios]) {
      await expect(phone.locator('[aria-label="현재 강조 순위"]')).toContainText('강조 순위 3위');
      await expect(phone.getByLabel('리더보드 페이지 위치', { exact: true })).toHaveText('3 / 25');
      await expect(phone.locator('[data-ranking-featured="true"]')).toHaveCount(0);
    }
    report.checks.push('same-page highlight command restores board focus, preserves student browsing and ignores count-only changes');
    await shot(wall, 'wall-same-page-highlight3.png');
    await shot(small, 'mobile320-manual-page-preserved.png');
    await verifyRank(3, teacher, wall, large, [small, ios], true);
    await verifyRank(10, teacher, wall, large, [small, ios]);
    report.checks.push('invalid/max10 rejected, duplicate normalized, requested1/3/10 synchronized');
    await shot(wall, 'wall-highlight10.png');

    await selectRanks(teacher, '1 10 50 200');
    for (const rank of [1, 10, 50, 200]) await verifyRank(rank, teacher, wall, large, [small, ios], rank === 1);
    report.checks.push('positions1/10/50/200 and page synchronization on wall/mobile');
    await shot(large, 'simulated4K-highlight200.png');
    const card = await large.locator('section[aria-label="실시간 리더보드"]').boundingBox();
    expect(card.y + card.height).toBeLessThanOrEqual(2160);

    for (const rank of [1, 10, 50]) {
      await teacher.getByRole('button', { name: '다음 강조', exact: true }).click();
      await expect.poll(async () => (await db.ref(`sessions/${sid}/leaderboardHighlight/activeRank`).get()).val()).toBe(rank);
    }
    await db.ref(`sessions/${sid}/scores/h_0/total`).set(0);
    await expect(wall.locator('[data-ranking-featured="true"][data-rank="50"]')).toContainText('강조폰320');
    const mobileJump = small.getByRole('button', { name: '현재 강조 순위 보기', exact: true });
    if (await mobileJump.count()) await mobileJump.click();
    await expect(small.locator('[data-ranking-featured="true"][data-rank="50"]')).toContainText('강조폰320');
    report.checks.push('highlight tracks displayed rank after live score reordering, not a fixed uid');
    await shot(small, 'mobile320-current-rank-change.png');
    await teacher.getByRole('button', { name: '강조 해제', exact: true }).click();
    await expect.poll(async () => (await db.ref(`sessions/${sid}/leaderboardHighlight`).get()).val()).toBeNull();
    for (const page of [wall, large, small, ios]) await expect(page.locator('[data-ranking-featured="true"]')).toHaveCount(0);
    expect(await wall.locator('[data-rank]').evaluateAll(rows => rows.every(row => getComputedStyle(row).boxShadow === 'none'))).toBe(true);
    report.checks.push('clear removes active badges and residual accents on every view');
    expect(report.errors).toEqual([]); expect(report.modelRequests).toEqual([]);
    report.durationMs = Date.now() - started;
    save();
    console.log(JSON.stringify({ result: 'PASS', checks: report.checks, durationMs: report.durationMs, artifacts }));
  } finally {
    if (chrome) await chrome.close(); if (safari) await safari.close();
    try {
      await db.ref(`sessions/${sid}`).remove();
      await db.ref(`sessionViewers/${sid}`).remove();
      for (const uid of anonymousUsers) await getAuth(app).deleteUser(uid);
    } finally { await deleteApp(app); }
  }
})().catch(error => { report.error = error.message; save(); console.error(error); process.exitCode = 1; });
