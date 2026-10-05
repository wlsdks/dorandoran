const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium, webkit, expect } = require('@playwright/test');

if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000'
  || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('Local demo emulators required');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5175';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error('Loopback QA origin required');
const deps = require('node:module').createRequire(path.resolve(__dirname, '../../functions/package.json'));
const { initializeApp, deleteApp } = deps('firebase-admin/app');
const { getDatabase } = deps('firebase-admin/database');
const { getAuth } = deps('firebase-admin/auth');
const app = initializeApp({ projectId: 'demo-dorandoran', databaseURL: 'https://demo-dorandoran.firebaseio.com' });
const db = getDatabase(app);
const artifacts = path.join(process.env.QA_ARTIFACT_DIR || os.tmpdir(), `dorandoran-reaction-sheet-${process.pid}`);
fs.mkdirSync(artifacts, { recursive: true });
const report = { checks: [], errors: [], modelRequests: [], screenshots: [] };
const users = new Set(), sessions = new Set(), browsers = [];
const save = () => fs.writeFileSync(path.join(artifacts, 'manifest.json'), JSON.stringify(report, null, 2));

async function visibleControls(page) {
  return page.getByRole('dialog', { name: '반응 보내기', exact: true }).evaluate(dialog => {
    const body = dialog.querySelector('[data-reaction-scroll]').getBoundingClientRect();
    const row = dialog.querySelector('[data-message-controls]').getBoundingClientRect();
    const input = dialog.querySelector('[aria-label="한마디 내용"]').getBoundingClientRect();
    const send = dialog.querySelector('[aria-label="한마디 보내기"]').getBoundingClientRect();
    const top = Math.max(body.top, window.visualViewport.offsetTop);
    const bottom = Math.min(body.bottom, window.visualViewport.offsetTop + window.visualViewport.height);
    return { visible: [row, input, send].every(rect => rect.top >= top - 1 && rect.bottom <= bottom + 1),
      top, bottom, rowTop: row.top, rowBottom: row.bottom, inputBottom: input.bottom, sendBottom: send.bottom };
  });
}

async function exercise(engine, viewport, keyboardHeight) {
  const sid = `qa_reaction_regression_${process.pid}_${engine}`;
  sessions.add(sid);
  const nickname = engine === 'webkit' ? '반응웹' : '반응폰';
  await db.ref(`sessions/${sid}`).set({ creatorId: 'legacy_master', courseId: 'course_a', courseName: '반응 키보드 회귀',
    createdAt: Date.now(), status: 'active', currentMode: 'waiting', aiEnabled: false });
  const browser = await (engine === 'webkit' ? webkit.launch() : chromium.launch(process.platform === 'darwin' ? { channel: 'chrome' } : {}));
  browsers.push(browser);
  const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true });
  await context.route('**/api/gemini/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/status')) return route.continue();
    report.modelRequests.push(pathname);
    return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => report.errors.push(`${engine}: ${error.message}`));
  try {
    await page.goto(`${base}/?s=${sid}`);
    await page.getByPlaceholder('닉네임 입력').fill(nickname);
    await page.getByRole('button', { name: '참여하기', exact: true }).click();
    const trigger = page.getByRole('button', { name: '반응 보내기', exact: true });
    await expect(trigger).toBeVisible();
    const uid = await page.evaluate(async () => (await import('/src/lib/auth-session.js')).auth.currentUser.uid);
    users.add(uid);
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: '반응 보내기', exact: true });
    await dialog.getByRole('button', { name: '한마디 입력', exact: true }).click();
    const input = dialog.getByRole('textbox', { name: '한마디 내용', exact: true });
    const send = dialog.getByRole('button', { name: '한마디 보내기', exact: true });
    await input.fill('😀'.repeat(12));
    await expect(input).toHaveValue('😀'.repeat(10));
    await page.evaluate(height => {
      window.__qaReactionViewportDescriptor = Object.getOwnPropertyDescriptor(window.visualViewport, 'height');
      Object.defineProperty(window.visualViewport, 'height', { configurable: true, get: () => height });
      window.visualViewport.dispatchEvent(new Event('resize'));
    }, keyboardHeight);
    await expect(input).toBeVisible(); await expect(send).toBeVisible();
    await expect.poll(async () => (await visibleControls(page)).visible, { message: `${engine} input/send row must fit synthetic keyboard viewport` }).toBe(true);
    report.checks.push({ engine, viewport, keyboardHeight, geometry: await visibleControls(page) });
    await page.screenshot({ path: path.join(artifacts, `${engine}-keyboard-controls.png`) });
    report.screenshots.push(`${engine}-keyboard-controls.png`);
    const composingPrevented = await input.evaluate(element => {
      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, isComposing: true });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(composingPrevented).toBe(true);
    expect((await db.ref(`sessions/${sid}/chatBubbles`).get()).val()).toBeNull();
    await send.click();
    const messages = async () => Object.values((await db.ref(`sessions/${sid}/chatBubbles`).get()).val() || {});
    await expect.poll(async () => (await messages()).length).toBe(1);
    const first = (await messages())[0];
    expect(first.text).toBe('😀'.repeat(10)); expect(first.text.length).toBe(20);
    expect(Array.from(first.text)).toHaveLength(10);
    expect(first.participantId).toBe(uid); expect(first.nickname).toBe(nickname);
    expect(typeof first.timestamp).toBe('number');
    await expect(dialog.getByRole('status')).toHaveText('한마디를 보냈어요.');
    await dialog.getByRole('button', { name: '한마디 입력', exact: true }).click();
    const korean = '함께 배우는 수업이 즐거워요';
    await input.fill(korean);
    await expect(send).toBeEnabled(); // Wait for the real shared 3-second cooldown.
    await expect.poll(async () => (await visibleControls(page)).visible).toBe(true);
    await input.press('Enter');
    await expect.poll(async () => (await messages()).length).toBe(2);
    const second = (await messages()).find(message => message.text === korean);
    expect(second.participantId).toBe(uid); expect(second.nickname).toBe(nickname);
    await expect(dialog.getByRole('status')).toHaveText('한마디를 보냈어요.');
    await page.evaluate(() => {
      const descriptor = window.__qaReactionViewportDescriptor;
      if (descriptor) Object.defineProperty(window.visualViewport, 'height', descriptor);
      else delete window.visualViewport.height;
      delete window.__qaReactionViewportDescriptor;
      window.visualViewport.dispatchEvent(new Event('resize'));
    });
    await dialog.getByRole('button', { name: '반응 닫기', exact: true }).click();
    await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
    report.checks.push({ engine, emojiUtf16Units: first.text.length, emojiCodepoints: Array.from(first.text).length,
      emojiAck: true, composingEnterPrevented: true, koreanEnterAck: true, closeFocusRestored: true });
    save();
  } catch (error) {
    if (await page.locator('[data-message-controls]').count()) report.failedGeometry = { engine, ...(await visibleControls(page)) };
    await page.screenshot({ path: path.join(artifacts, `${engine}-failure.png`) }).catch(() => {});
    throw error;
  } finally {
    // Also retain the fresh anonymous UID when a UI assertion fails before
    // normal join completion, so failure paths clean up their own account.
    const anonymousUid = await page.evaluate(async () => {
      const { auth } = await import('/src/lib/auth-session.js');
      return auth.currentUser?.isAnonymous ? auth.currentUser.uid : null;
    }).catch(() => null);
    if (anonymousUid) users.add(anonymousUid);
    await page.evaluate(() => {
      if (!Object.hasOwn(window, '__qaReactionViewportDescriptor')) return;
      const descriptor = window.__qaReactionViewportDescriptor;
      if (descriptor) Object.defineProperty(window.visualViewport, 'height', descriptor);
      else delete window.visualViewport.height;
      delete window.__qaReactionViewportDescriptor;
      window.visualViewport.dispatchEvent(new Event('resize'));
    }).catch(() => {});
  }
}

(async () => {
  const started = Date.now();
  try {
    await exercise('webkit', { width: 320, height: 600 }, 300);
    await exercise('chrome', { width: 390, height: 844 }, 330);
    expect(report.errors).toEqual([]); expect(report.modelRequests).toEqual([]);
    report.durationMs = Date.now() - started; save();
    console.log(JSON.stringify({ result: 'PASS', ...report, artifacts }));
  } finally {
    for (const browser of browsers) await browser.close();
    try {
      for (const sid of sessions) { await db.ref(`sessions/${sid}`).remove(); await db.ref(`sessionViewers/${sid}`).remove(); }
      for (const uid of users) await getAuth(app).deleteUser(uid);
    } finally { await deleteApp(app); }
  }
})().catch(error => { report.error = error.message; save(); console.error(error); process.exitCode = 1; });
