const { chromium, expect } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch(process.platform === 'darwin' ? { channel: 'chrome' } : {});
  try {
    const page = await browser.newPage();
    const issues = [];
    page.on('pageerror', error => issues.push(error.message));
    page.on('console', message => { if (['warning', 'error'].includes(message.type())) issues.push(message.text()); });
    await page.goto('http://127.0.0.1:5175/live?s=qa_room');
    const cdp = await page.context().newCDPSession(page);
    // Playwright의 일반 evaluate는 사용자 활성화를 부여할 수 있어 원시 CDP로 관찰한다.
    const observe = async expression => (await cdp.send('Runtime.evaluate', {
      expression, awaitPromise: true, userGesture: false, returnByValue: true,
    })).result.value;
    const before = await observe(`(async () => {
      const Original = window.AudioContext; window.__qaCreated = 0;
      window.AudioContext = class extends Original { constructor(...args) {
        super(...args); window.__qaCreated++; window.__qaAudio = this;
      }};
      await (await import('/src/lib/chime.js')).playChime();
      return { active: navigator.userActivation.hasBeenActive, created: window.__qaCreated };
    })()`);
    expect(before).toEqual({ active: false, created: 0 });
    await page.getByRole('button', { name: '전체화면 보기', exact: true }).click();
    const after = await observe(`(async () => {
      await (await import('/src/lib/chime.js')).playChime();
      return { active: navigator.userActivation.hasBeenActive, created: window.__qaCreated, state: window.__qaAudio?.state };
    })()`);
    expect(after).toEqual({ active: true, created: 1, state: 'running' });
    expect(issues).toEqual([]);
    console.log(JSON.stringify({ result: 'PASS', audio: { before, after }, issues }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
