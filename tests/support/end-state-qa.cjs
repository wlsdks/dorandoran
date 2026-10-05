if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('Local demo emulators required');
const fs = require('fs'),
  {
    createRequire
  } = require('module');
const path = require('node:path'),
  os = require('node:os');
const root = path.resolve(__dirname, '../..'),
  d = createRequire(root + '/functions/package.json'),
  {
    chromium,
    expect
  } = require(root + '/node_modules/@playwright/test');
process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const {
    initializeApp,
    deleteApp
  } = d('firebase-admin/app'),
  {
    getDatabase
  } = d('firebase-admin/database'),
  {
    getAuth
  } = d('firebase-admin/auth');
const app = initializeApp({
    projectId: 'demo-dorandoran',
    databaseURL: 'https://demo-dorandoran.firebaseio.com'
  }, 'copy-QA'),
  db = getDatabase(app),
  sid = 'qa_endstate_' + process.pid,
  report = {
    checks: [],
    errors: []
  };
let browser, uid;
(async () => {
  await db.ref('sessions/' + sid).set({
    creatorId: 'legacy_master',
    courseId: 'course_a',
    courseName: '수업 기록 링크 검수',
    createdAt: Date.now(),
    status: 'active',
    currentMode: 'waiting'
  });
  browser = await chromium.launch(process.platform === 'darwin' ? {
    channel: 'chrome'
  } : {});
  const p = await browser.newPage({
    viewport: {
      width: 390,
      height: 844
    },
    isMobile: true,
    hasTouch: true
  });
  p.on('pageerror', e => report.errors.push(e.message));
  await p.addInitScript(() => {
    window.__copyTimers = new Set();
    const start = window.setTimeout.bind(window),
      stop = window.clearTimeout.bind(window);
    window.setTimeout = (fn, ms, ...args) => {
      const owned = ms === 2000 && String(fn).includes('setCopied');
      let id;
      id = start(() => {
        window.__copyTimers.delete(id);
        fn(...args);
      }, ms);
      if (owned) window.__copyTimers.add(id);
      return id;
    };
    window.clearTimeout = id => {
      window.__copyTimers.delete(id);
      return stop(id);
    };
  });
  await p.goto('http://127.0.0.1:5175/?s=' + sid);
  await p.getByPlaceholder('닉네임 입력').fill('복사검수');
  await p.getByRole('button', {
    name: '참여하기',
    exact: true
  }).click();
  await expect(p.getByRole('button', {
    name: '학습자 설정'
  })).toBeVisible();
  uid = await p.evaluate(async () => (await import('/src/lib/auth-session.js')).auth.currentUser.uid);
  await db.ref('sessions/' + sid + '/status').set('ended');
  await expect(p.getByRole('button', {
    name: '링크 복사',
    exact: true
  })).toBeVisible();
  await p.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async () => {
        throw Error('blocked');
      }
    }
  }));
  await p.getByRole('button', {
    name: '링크 복사',
    exact: true
  }).click();
  await expect(p.getByRole('alert')).toContainText('직접 열어 주세요');
  await p.screenshot({
    path: path.join(process.env.QA_ARTIFACT_DIR || os.tmpdir(), 'dorandoran-copy-error-' + process.pid + '.png')
  });
  report.checks.push('clipboard rejection has actionable feedback');
  await p.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async () => {}
    }
  }));
  await p.getByRole('button', {
    name: '링크 복사',
    exact: true
  }).click();
  await expect(p.getByRole('button', {
    name: '복사됨',
    exact: true
  })).toBeVisible();
  expect(await p.evaluate(() => window.__copyTimers.size)).toBe(1);
  await db.ref('sessions/' + sid).update({
    status: 'active',
    currentMode: 'joinShow'
  });
  await expect(p.getByText(/복사검수.*준비됐어요/)).toBeVisible();
  await expect(p.getByRole('button', {
    name: '학습자 설정'
  })).toBeVisible();
  await expect.poll(() => p.evaluate(() => window.__copyTimers.size)).toBe(0);
  report.checks.push('copy success timer cleared on ended-page unmount');
  await db.ref('sessions/' + sid + '/status').set('ended');
  await expect(p.getByRole('button', {
    name: '링크 복사',
    exact: true
  })).toBeVisible();
  await p.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: () => new Promise(resolve => {
        window.__resolveCopy = resolve;
      })
    }
  }));
  await p.getByRole('button', {
    name: '링크 복사',
    exact: true
  }).click();
  await db.ref('sessions/' + sid).update({
    status: 'active',
    currentMode: 'joinShow'
  });
  await expect(p.getByText(/복사검수.*준비됐어요/)).toBeVisible();
  await p.waitForTimeout(200);
  await p.evaluate(() => window.__resolveCopy());
  await p.waitForTimeout(200);
  expect(await p.evaluate(() => window.__copyTimers.size)).toBe(0);
  report.checks.push('delayed clipboard completion after unmount does not schedule another timer');
  expect(report.errors).toEqual([]);
  fs.writeFileSync(path.join(process.env.QA_ARTIFACT_DIR || os.tmpdir(), 'dorandoran-copy-result-' + process.pid + '.json'), JSON.stringify(report, null, 2));
  console.log(report);
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
}).finally(async () => {
  await browser?.close();
  await db.ref('sessions/' + sid).remove();
  if (uid) await getAuth(app).deleteUser(uid);
  await deleteApp(app);
});
