const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium, webkit, expect } = require('@playwright/test');

if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000'
  || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099'
  || (process.env.VITE_FIREBASE_PROJECT_ID && !process.env.VITE_FIREBASE_PROJECT_ID.startsWith('demo-'))) {
  throw new Error('Local demo environment required');
}
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5175';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error('Loopback QA origin required');
const artifacts = path.join(process.env.QA_ARTIFACT_DIR || os.tmpdir(), `dorandoran-dialog-layer-${process.pid}`);
fs.mkdirSync(artifacts, { recursive: true });
const report = { checks: [], errors: [], modelRequests: [] };
const save = () => fs.writeFileSync(path.join(artifacts, 'manifest.json'), JSON.stringify(report, null, 2));

// Import the installed components without mounting App or connecting Firebase.
// Read Vite's current React module URL rather than hardcoding its optimizer hash.
async function harness() {
  const response = await fetch(`${base}/src/components/ui/BottomSheet.jsx`);
  if (!response.ok) throw new Error('QA Vite server is unavailable');
  const source = await response.text();
  const react = source.match(/["']([^"']*\/react\.js(?:\?[^"']*)?)["']/)?.[1];
  if (!react?.startsWith('/node_modules/')) throw new Error('Vite React module URL missing');
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>
    <div id="root"></div><button id="outside">외부 버튼</button>
    <script type="module">
      import Refresh from '/@react-refresh';
      Refresh.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => type => type;
      window.__vite_plugin_react_preamble_installed__ = true;
    </script>
    <script type="module">
      import React from ${JSON.stringify(react)};
      import Client from '/node_modules/.vite/deps/react-dom_client.js';
      import BottomSheet from '/src/components/ui/BottomSheet.jsx';
      import Modal from '/src/components/ui/Modal.jsx';
      import Viewport from '/src/components/ui/VisualViewportSupport.jsx';
      import '/src/styles/index.css';
      const h = React.createElement;
      function App() {
        const [open, setOpen] = React.useState(false);
        const [nested, setNested] = React.useState(false);
        const [step, setStep] = React.useState(true);
        return h(React.Fragment, null, h(Viewport),
          h('button', { id: 'launcher', onClick: () => setOpen(true) }, '시트 열기'),
          h(BottomSheet, { open, onClose: () => setOpen(false), ariaLabel: '검수 시트' },
            h('button', { id: 'nested-open', onClick: () => setNested(true) }, '중첩 창 열기'),
            h('button', { disabled: true }, '비활성 버튼'),
            step && h('button', { id: 'step', onClick: () => setStep(false) }, '단계 바꾸기'),
            h('input', { id: 'sheet-input', 'aria-label': '시트 입력' }),
            Array.from({ length: 20 }, (_, i) => h('p', { key: i }, '스크롤 내용 ' + i)),
            h(Modal, { open: nested, onClose: () => setNested(false), ariaLabel: '검수 중첩 창' },
              h('input', { id: 'nested-input', 'aria-label': '중첩 입력' }),
              h('button', { id: 'nested-last' }, '확인'))));
      }
      const root = Client.createRoot(document.getElementById('root'));
      root.render(h(React.StrictMode, null, h(App)));
      window.__qaUnmount = () => root.unmount();
    </script></body></html>`;
}

async function tabSequence(page, selectors, key = 'Tab') {
  for (const selector of selectors) {
    await page.keyboard.press(key);
    await expect(page.locator(selector)).toBeFocused();
  }
}

async function exercise(engine, html) {
  // Chromium LNA treats route.fulfill documents as having no network origin.
  // This flag is limited to this isolated loopback component harness.
  const browser = await (engine === 'webkit' ? webkit.launch() : chromium.launch({
    ...(process.platform === 'darwin' ? { channel: 'chrome' } : {}),
    args: ['--disable-features=LocalNetworkAccessChecks'],
  }));
  const context = await browser.newContext({ viewport: { width: 390, height: 600 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => report.errors.push(`${engine}: ${error.message}`));
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (/gemini|generativelanguage/.test(url.href)) { report.modelRequests.push(url.pathname); return route.abort(); }
    if (url.origin !== base) return route.fulfill({ status: 200, contentType: 'text/css', body: '' }); // Existing CDN font CSS only.
    if (url.pathname === '/__qa_dialog_layer') return route.fulfill({ status: 200, contentType: 'text/html', body: html });
    return route.continue();
  });
  try {
    await page.goto(`${base}/__qa_dialog_layer`);
    const launcher = page.locator('#launcher');
    const sheet = page.getByRole('dialog', { name: '검수 시트', exact: true });
    const nested = page.getByRole('dialog', { name: '검수 중첩 창', exact: true });
    const overflow = await page.evaluate(() => document.body.style.overflow);
    await launcher.focus(); await launcher.press('Enter');
    await expect(sheet).toBeFocused();
    const close = '[aria-label="패널 닫기"]';
    await tabSequence(page, [close, '#nested-open', '#step', '#sheet-input', close]);
    await tabSequence(page, ['#sheet-input', '#step', '#nested-open', close, '#sheet-input'], 'Shift+Tab');
    await page.locator('#step').focus(); await page.locator('#step').press('Enter');
    await expect(page.locator('#step')).toHaveCount(0);
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    await tabSequence(page, [close]); // Recover after React removes the focused node.
    await page.locator('#sheet-input').fill('내용 스크롤 중');
    await expect(sheet).toBeVisible();
    await page.evaluate(() => {
      Object.defineProperty(visualViewport, 'height', { configurable: true, value: 300 });
      Object.defineProperty(visualViewport, 'offsetTop', { configurable: true, value: 40 });
      visualViewport.dispatchEvent(new Event('resize'));
    });
    await expect.poll(async () => sheet.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return rect.top >= 39 && rect.bottom <= 341 && rect.height <= 269;
    })).toBe(true);
    await page.screenshot({ path: path.join(artifacts, `${engine}-short-viewport.png`) });
    await page.locator('#nested-open').focus(); await page.locator('#nested-open').press('Enter');
    await expect(nested).toBeFocused();
    await tabSequence(page, ['#nested-input', '#nested-last', '#nested-input']);
    await tabSequence(page, ['#nested-last', '#nested-input'], 'Shift+Tab');
    await page.keyboard.press('Escape');
    await expect(nested).toHaveCount(0); await expect(sheet).toBeVisible();
    await expect(page.locator('#nested-open')).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0); await expect(launcher).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe(overflow);
    await page.evaluate(() => {
      delete visualViewport.height; delete visualViewport.offsetTop;
      visualViewport.dispatchEvent(new Event('resize'));
    });
    await expect.poll(() => page.evaluate(() => ({
      height: parseFloat(document.documentElement.style.getPropertyValue('--app-visible-height')),
      top: parseFloat(document.documentElement.style.getPropertyValue('--app-visible-top')),
    }))).toEqual({ height: 600, top: 0 });
    await launcher.press('Enter'); await expect(sheet).toBeFocused();
    // Viewport restoration and motion feature registration use animation frames.
    // Measure the handle only after both frames, before beginning a real gesture.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const initialTop = (await sheet.boundingBox()).y;
    const handle = await page.locator('.cursor-grab').boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(80);
    for (let step = 1; step <= 10; step++) {
      await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 + 20 * step);
      await page.waitForTimeout(20); // Allow real pointer/animation frames to run.
    }
    await expect.poll(async () => (await sheet.boundingBox()).y - initialTop,
      { message: `${engine} handle must move the sheet before releasing the gesture` }).toBeGreaterThan(100);
    const dragPixels = (await sheet.boundingBox()).y - initialTop;
    await page.mouse.up(); await expect(sheet).toHaveCount(0); await expect(launcher).toBeFocused();
    await launcher.press('Enter'); await expect(sheet).toBeFocused();
    await page.locator('#nested-open').focus(); await page.locator('#nested-open').press('Enter');
    await expect(nested).toBeFocused();
    await page.evaluate(() => window.__qaUnmount());
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe(overflow);
    const preventedAfterUnmount = await page.locator('#outside').evaluate(element => ['Tab', 'Escape'].map(key => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      element.dispatchEvent(event); return event.defaultPrevented;
    }));
    expect(preventedAfterUnmount).toEqual([false, false]);
    report.checks.push({ engine, naturalTab: true, reverseTab: true, disabledSkipped: true,
      deletedFocusRecovery: true, nestedEscapeOne: true, triggerFocusRestore: true,
      shortViewport: true, handleDragClose: true, dragPixels, unmountCleanup: true });
    save();
  } catch (error) {
    await page.screenshot({ path: path.join(artifacts, `${engine}-failure.png`) }).catch(() => {});
    throw error;
  } finally {
    await page.evaluate(() => window.__qaUnmount?.()).catch(() => {});
    await browser.close();
  }
}

(async () => {
  const html = await harness();
  await exercise('chrome', html); await exercise('webkit', html);
  expect(report.errors).toEqual([]); expect(report.modelRequests).toEqual([]);
  report.result = 'PASS'; save();
  console.log(JSON.stringify({ ...report, artifacts }));
})().catch(error => {
  report.result = 'FAIL'; report.failure = error.stack; save();
  console.error(error); process.exitCode = 1;
});
