// Real browser/API/storage regression: only this demo fixture and its derived name index are removed.
const { chromium, expect } = require('@playwright/test');
const { createRequire } = require('node:module');
const { resolve, join } = require('node:path');
const { tmpdir } = require('node:os');
const { mkdirSync, readFileSync } = require('node:fs');

if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000'
    || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099'
    || process.env.FIREBASE_STORAGE_EMULATOR_HOST !== '127.0.0.1:9199') throw new Error('Submission QA requires the localhost demo emulators.');
const dependency = createRequire(resolve(__dirname, '../../functions/package.json'));
const { initializeApp, deleteApp } = dependency('firebase-admin/app');
const { getDatabase } = dependency('firebase-admin/database');
const { getStorage } = dependency('firebase-admin/storage');
const app = initializeApp({ projectId: 'demo-dorandoran', databaseURL: 'https://demo-dorandoran.firebaseio.com', storageBucket: 'demo-dorandoran.appspot.com' });
const database = getDatabase(app);
const aid = 'qa_submission_regression';
const fixture = database.ref(`assignments/${aid}`);
const base = 'http://127.0.0.1:5175';
const icon = resolve(__dirname, '../../public/icon-192.png');
const shots = join(tmpdir(), `dorandoran-submission-${process.pid}`);
mkdirSync(shots, { recursive: true });
const name = '자료제출QA', pin = '12345678';
const prd = '반복되는 자료 설명을 줄이기 위해 만든 예시입니다. 팀원들이 필요한 정보를 쉽고 빠르게 찾을 수 있도록 간단한 화면으로 구성하고 함께 확인하려고 합니다.';
const code = '<!DOCTYPE html><html><body><h1>직접 작성한 자료 제출 예시</h1></body></html>';
const errors = [], modelRequests = [], users = new Set();
let browser, page, submissionId, originalCredential;
async function newPage() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.route('**/api/gemini/**', route => {
    if (route.request().url().endsWith('/status')) return route.continue();
    modelRequests.push(route.request().url()); return route.abort();
  });
  const result = await context.newPage();
  result.setDefaultTimeout(8000);
  result.on('pageerror', error => errors.push(error.message));
  await result.goto(base);
  expect(await result.evaluate(async () => {
    const { app } = await import('/src/lib/firebase.js');
    const { auth } = await import('/src/lib/auth-session.js');
    return app.options.projectId === 'demo-dorandoran' && auth.emulatorConfig?.host === '127.0.0.1' && auth.emulatorConfig?.port === 9099;
  })).toBe(true);
  await result.goto(`${base}/submit?a=${aid}`);
  return result;
}
async function rememberUser() {
  users.add(await page.evaluate(async () => (await import('/src/lib/auth-session.js')).auth.currentUser.uid));
}
async function lookup(lookupName, lookupPin) {
  await page.getByRole('button', { name: '내 제출물 조회', exact: true }).click();
  await rememberUser();
  await page.getByPlaceholder('제출 시 입력한 이름').fill(lookupName);
  await page.getByPlaceholder('조회용 비밀번호').fill(lookupPin);
  await page.getByRole('button', { name: '조회하기', exact: true }).click();
  await expect(page.getByText(`${lookupName}님의 제출물`, { exact: true })).toBeVisible();
}

(async () => {
  try {
    await database.ref(`assignmentNames/${aid}`).remove();
    await fixture.set({ title: '자료 제출 회귀 점검', description: '직접 작성한 자료를 제출해주세요.',
      courseName: '자료 제출 QA', ownerId: 'legacy_master', createdAt: Date.now(), status: 'open', hasJudging: false });
    browser = await chromium.launch(process.platform === 'darwin' ? { channel: 'chrome' } : {});
    page = await newPage();
    await page.getByRole('button', { name: '과제 제출하기', exact: true }).click();
    await rememberUser();
    // Synthetic oversized payload built from our own PNG; the client must reject before any upload.
    await page.locator('input[type="file"][accept="image/*"]').setInputFiles({ name: 'too-large.png', mimeType: 'image/png',
      buffer: Buffer.concat([readFileSync(icon), Buffer.alloc(10 * 1024 * 1024)]) });
    await expect(page.getByText(/10MB 초과/)).toBeVisible();
    await page.waitForTimeout(650);
    await page.screenshot({ path: join(shots, 'oversized-rejected.png') });
    await page.reload();
    await page.getByRole('button', { name: '과제 제출하기', exact: true }).click();
    await page.getByPlaceholder('이름을 입력하세요').fill(name);
    await page.getByPlaceholder('••••••••').first().fill(pin);
    await page.getByPlaceholder('••••••••').nth(1).fill(pin);
    await page.locator('textarea').first().fill(prd);
    await page.getByRole('textbox', { name: 'HTML 코드', exact: true }).fill(code);
    await page.locator('input[type="file"][accept="image/*"]').setInputFiles(icon);
    await expect(page.getByRole('button', { name: '제출하기', exact: true })).toBeEnabled();
    expect(await page.locator('body').innerText()).not.toContain('AI 예심');
    await page.getByRole('button', { name: '제출하기', exact: true }).click();
    await expect(page.getByRole('heading', { name: '제출 완료!', exact: true })).toBeVisible();
    expect(await page.locator('body').innerText()).not.toMatch(/AI 예심|심사 결과|심사위원/);
    await page.waitForTimeout(650);
    await page.screenshot({ path: join(shots, 'submitted.png') });
    const entries = Object.entries((await fixture.child('submissions').get()).val() || {});
    expect(entries).toHaveLength(1);
    const [id, submitted] = entries[0]; submissionId = id; originalCredential = submitted.pinCredential;
    expect(submitted.screenshots).toHaveLength(1);
    expect(submitted.screenshots[0].url).toMatch(/^http:\/\/127\.0\.0\.1:9199\//);

    page = await newPage(); // A fresh anonymous identity proves PIN recovery, rather than owner bypass.
    await lookup(name, pin);
    await page.getByRole('button', { name: '수정하기', exact: true }).click();
    await page.locator('textarea').first().fill(`${prd} 수정한 자료입니다.`);
    await page.getByRole('button', { name: '수정 제출', exact: true }).click();
    await expect(page.getByRole('heading', { name: '제출 완료!', exact: true })).toBeVisible();
    let saved = (await fixture.child(`submissions/${submissionId}`).get()).val();
    expect(saved.prdContent).toContain('수정한 자료');
    expect(saved.pinCredential).toEqual(originalCredential);

    await fixture.child('status').set('closed');
    const rejected = await page.evaluate(async assignmentId => {
      const { authenticatedRequest } = await import('/src/lib/auth-session.js');
      try { await authenticatedRequest('/api/assignments/submit', { assignmentId, name: '자료제출QA', pin: '12345678',
        allowUpdate: true, prdContent: '마감 후 변경', code: '<html>변경</html>' }); return false; }
      catch { return true; }
    }, aid);
    expect(rejected).toBe(true);
    saved = (await fixture.child(`submissions/${submissionId}`).get()).val();
    expect(saved.prdContent).toContain('수정한 자료');
    expect(saved.pinCredential).toEqual(originalCredential);

    const legacy = { name: '기존조회QA', pin: '4321', prdContent: prd, code, submittedAt: Date.now() };
    await fixture.child('submissions/legacy').set(legacy);
    page = await newPage();
    await lookup(legacy.name, legacy.pin);
    expect((await fixture.child('submissions/legacy').get()).val()).toEqual(legacy);
    await page.waitForTimeout(650);
    await page.screenshot({ path: join(shots, 'legacy-lookup.png') });
    expect(errors).toEqual([]); expect(modelRequests).toEqual([]);
    console.log(JSON.stringify({ result: 'PASS', ownedPngSubmit: true, oversizedRejected: true, freshEightPinLookupEdit: true,
      oldFourPinPreserved: true, closedWriteRejected: true, errors, modelRequests, screenshots: shots }));
  } finally {
    if (browser) await browser.close();
    await fixture.remove();
    await database.ref(`assignmentNames/${aid}`).remove();
    for (const uid of users) await database.ref(`submissionGrants/${uid}/${aid}`).remove();
    await getStorage(app).bucket().deleteFiles({ prefix: `assignments/${aid}/` });
    await deleteApp(app);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
