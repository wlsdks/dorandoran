// Actual StrictMode lifecycle regression; never edits app source or production data.
if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw Error('Local demo emulators required');
const fs = require('fs'),
  {
    createRequire
  } = require('module');
const root = require('node:path').resolve(__dirname, '../..'),
  req = createRequire(root + '/package.json'),
  {
    chromium,
    expect
  } = req('@playwright/test');
const base = 'http://127.0.0.1:5175',
  out = require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'dorandoran-achievement-')),
  scope = 'toast_runtime_' + Date.now();
let browser;
const errors = [],
  hotUpdates = [];
async function setup(p) {
  await p.evaluate(async scope => {
    const ReactModule = await import('/node_modules/.vite/deps/react.js'),
      DOM = await import('/node_modules/.vite/deps/react-dom_client.js'),
      {
        default: Toast
      } = await import('/src/features/quiz/components/AchievementToast.jsx');
    const R = ReactModule.default,
      createRoot = DOM.createRoot || DOM.default.createRoot;
    const host = document.createElement('div');
    document.body.append(host);
    const nativeSet = window.setTimeout.bind(window),
      nativeClear = window.clearTimeout.bind(window),
      timers = new Set(),
      events = [];
    window.setTimeout = (callback, delay, ...args) => {
      const own = new Error().stack.includes('AchievementToast.jsx');
      let id;
      id = nativeSet((...x) => {
        timers.delete(id);
        callback(...x);
      }, delay, ...args);
      if (own) {
        timers.add(id);
        events.push({
          kind: 'schedule',
          delay,
          at: Date.now()
        });
      }
      return id;
    };
    window.clearTimeout = id => {
      if (timers.has(id)) events.push({
        kind: 'cancel',
        at: Date.now()
      });
      timers.delete(id);
      nativeClear(id);
    };
    const additions = {};
    new MutationObserver(records => {
      for (const r of records) for (const node of r.addedNodes) {
        if (node.nodeType !== 1) continue;
        const nodes = [...(node.matches('[data-achievement-id]') ? [node] : []), ...node.querySelectorAll('[data-achievement-id]')];
        for (const el of nodes) {
          const id = el.dataset.achievementId;
          additions[id] = (additions[id] || 0) + 1;
        }
      }
    }).observe(document.body, {
      childList: true,
      subtree: true
    });
    let reactRoot = createRoot(host),
      model = {
        sessionId: scope,
        participantId: 'learner',
        ready: false,
        achievements: []
      };
    const render = (patch = {}) => {
      model = {
        ...model,
        ...patch
      };
      reactRoot.render(R.createElement(R.StrictMode, null, R.createElement(Toast, {
        ...model,
        achievements: model.achievements.map(a => ({
          ...a
        }))
      })));
    };
    window.toastHarness = {
      render,
      events,
      additions,
      timers,
      unmount: () => reactRoot.unmount(),
      remount: () => {
        reactRoot.unmount();
        reactRoot = createRoot(host);
        render();
      },
      key: () => `dorandoran_achievement_seen:${JSON.stringify([model.sessionId, model.participantId])}`
    };
    render();
  }, scope);
}
(async () => {
  browser = await chromium.launch(process.platform === 'darwin' ? {
    channel: 'chrome'
  } : {});
  const c = await browser.newContext({
      viewport: {
        width: 390,
        height: 844
      }
    }),
    p = await c.newPage();
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => {
    if (m.text().includes('hot updated') && m.text().includes('AchievementToast.jsx')) hotUpdates.push(m.text());
    if (m.type() === 'error') errors.push(m.text());
  });
  await p.goto(base + '/');
  await p.waitForLoadState('networkidle');
  await setup(p);
  const a = {
      id: 'first-correct',
      label: '첫 정답',
      icon: 'Sparkle'
    },
    b = {
      id: 'streak-5',
      label: '5연속 정답',
      icon: 'Flame'
    },
    d = {
      id: 'lightning-fast',
      label: '번개 응답',
      icon: 'Zap'
    };
  await p.evaluate(() => toastHarness.render({
    ready: true
  }));
  await expect.poll(() => p.evaluate(() => sessionStorage.getItem(toastHarness.key()))).toBe('[]');
  await p.evaluate(a => toastHarness.render({
    achievements: [a]
  }), a);
  await expect(p.locator('[data-achievement-id="first-correct"]')).toBeVisible();
  const firstSeen = Date.now();
  await p.screenshot({
    path: out + '/01-strict-snackbar.png'
  });
  for (let i = 0; i < 20; i++) {
    await p.evaluate(() => toastHarness.render());
    await p.waitForTimeout(20);
  }
  await p.waitForTimeout(Math.max(0, 4000 - (Date.now() - firstSeen)));
  await expect(p.locator('[data-achievement-id]')).toHaveCount(0);
  await expect.poll(() => p.evaluate(() => toastHarness.timers.size)).toBe(0);
  expect(await p.evaluate(() => toastHarness.additions['first-correct'])).toBe(1);
  for (let i = 0; i < 20; i++) {
    await p.evaluate(() => toastHarness.remount());
    await p.waitForTimeout(20);
  }
  await expect(p.locator('[data-achievement-id]')).toHaveCount(0);
  expect(await p.evaluate(() => toastHarness.additions['first-correct'])).toBe(1);
  const beforeReload = await p.evaluate(() => ({
    additions: toastHarness.additions,
    events: toastHarness.events
  }));
  await p.reload();
  await p.waitForLoadState('networkidle');
  await setup(p);
  await p.evaluate(() => toastHarness.render({
    ready: true
  }));
  await expect.poll(() => p.evaluate(() => JSON.parse(sessionStorage.getItem(toastHarness.key()) || '[]'))).toContain(a.id);
  await p.evaluate(a => toastHarness.render({
    achievements: [a]
  }), a);
  await p.waitForTimeout(250);
  expect(await p.locator('[data-achievement-id]').count()).toBe(0);
  await p.evaluate(({
    a,
    b
  }) => toastHarness.render({
    achievements: [a, b]
  }), {
    a,
    b
  });
  await expect(p.locator('[data-achievement-id="streak-5"]')).toBeVisible();
  for (let i = 0; i < 20; i++) await p.evaluate(() => toastHarness.render());
  await p.waitForTimeout(4000);
  await expect(p.locator('[data-achievement-id]')).toHaveCount(0);
  expect(await p.evaluate(() => toastHarness.additions['streak-5'])).toBe(1);
  await p.evaluate(({
    a,
    b,
    d
  }) => toastHarness.render({
    achievements: [a, b, d]
  }), {
    a,
    b,
    d
  });
  await expect(p.locator('[data-achievement-id="lightning-fast"]')).toBeVisible();
  expect(await p.evaluate(() => toastHarness.timers.size)).toBe(1);
  await p.evaluate(() => toastHarness.unmount());
  expect(await p.evaluate(() => toastHarness.timers.size)).toBe(0);
  await p.waitForTimeout(100);
  await expect(p.locator('[data-achievement-id]')).toHaveCount(0);
  await p.evaluate(() => toastHarness.remount());
  await p.waitForTimeout(100);
  await p.evaluate(() => toastHarness.render({
    sessionId: 'other_session',
    achievements: [],
    ready: false
  }));
  await p.evaluate(() => toastHarness.render({
    ready: true,
    achievements: []
  }));
  await expect.poll(() => p.evaluate(() => sessionStorage.getItem(toastHarness.key()))).toBe('[]');
  await p.evaluate(a => toastHarness.render({
    achievements: [a]
  }), a);
  await expect(p.locator('[data-achievement-id]')).toBeVisible();
  await p.evaluate(() => toastHarness.render({
    participantId: 'different_learner',
    achievements: []
  }));
  await expect(p.locator('[data-achievement-id]')).toHaveCount(0);
  expect(await p.evaluate(() => toastHarness.timers.size)).toBe(0);
  await p.evaluate(({
    a,
    b
  }) => toastHarness.render({
    participantId: 'baseline_learner',
    achievements: [a, b],
    ready: true
  }), {
    a,
    b
  });
  await p.waitForTimeout(100);
  await expect(p.locator('[data-achievement-id]')).toHaveCount(0);
  expect(await p.evaluate(() => toastHarness.timers.size)).toBe(0);
  const baselineIds = await p.evaluate(() => JSON.parse(sessionStorage.getItem(toastHarness.key())));
  expect(baselineIds).toEqual([a.id, b.id]);
  const after = await p.evaluate(() => ({
    additions: toastHarness.additions,
    events: toastHarness.events,
    timers: toastHarness.timers.size
  }));
  expect(errors).toEqual([]);
  const report = {
    passed: true,
    strictMode: true,
    rerenders: 20,
    remounts: 20,
    reloadOldIdReappeared: false,
    nextIdAppearances: after.additions['streak-5'],
    unmountActiveTimerCount: 0,
    scopeChangeOldToastGone: true,
    existingReadyBaselineSilent: true,
    baselineIds,
    hmrUpdates: hotUpdates.length,
    hmrMessages: hotUpdates,
    beforeReload,
    after,
    errors
  };
  fs.writeFileSync(out + '/strict-result.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
})().catch(e => {
  fs.writeFileSync(out + '/strict-failure.json', JSON.stringify({
    error: e.stack,
    hotUpdates,
    errors
  }, null, 2));
  console.error(e.stack);
  process.exitCode = 1;
}).finally(async () => {
  await browser?.close();
});
