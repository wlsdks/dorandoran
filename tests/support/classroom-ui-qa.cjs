const {
  chromium,
  webkit,
  expect
} = require('@playwright/test');
const dep = require('node:module').createRequire(require('node:path').resolve(__dirname, '../../functions/package.json'));
process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000';
const {
  initializeApp
} = dep('firebase-admin/app');
const {
  getDatabase
} = dep('firebase-admin/database');
const db = getDatabase(initializeApp({
  projectId: 'demo-dorandoran',
  databaseURL: 'https://demo-dorandoran.firebaseio.com'
}));
const base = 'http://127.0.0.1:5175';
const sid = 'ui_audit';
const errors = [];
const evidence = [];
const health = async p => {
  expect(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await p.title()).toBe('도란도란 · DoranDoran');
};
(async () => {
  const browser = await chromium.launch(process.platform === 'darwin' ? {
    channel: 'chrome'
  } : {});
  try {
    const c = await browser.newContext({
      viewport: {
        width: 1512,
        height: 982
      }
    });
    const p = await c.newPage();
    p.on('pageerror', e => errors.push(e.message));
    await p.goto(base + '/admin');
    await p.getByPlaceholder('아이디').fill('qa-master');
    await p.getByPlaceholder('비밀번호').fill('TestFixture-Only-Strong8');
    await p.getByRole('button', {
      name: '로그인',
      exact: true
    }).click();
    await expect(p.getByRole('button', {
      name: '내 클래스',
      exact: true
    })).toBeVisible();
    await p.goto(base + '/admin?s=' + sid);
    await p.getByRole('button', {
      name: '발표 모드',
      exact: true
    }).click();
    await expect(p.getByAltText('슬라이드 3')).toBeVisible();
    await p.getByRole('button', {
      name: 'QR코드 열기',
      exact: true
    }).click();
    await expect(p.getByRole('dialog', {
      name: '수업 참여 QR'
    })).toBeVisible();
    await expect.poll(() => p.locator('.participation-qr svg').evaluate(e => {
      const r = e.getBoundingClientRect();
      return !!document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('[role="dialog"]');
    })).toBe(true);
    await p.waitForTimeout(350);
    await p.screenshot({
      path: '/tmp/dorandoran-after-presenter-qr.png'
    });
    await p.keyboard.press('Escape');
    await expect(p.getByRole('dialog')).not.toBeVisible();
    await expect(p.getByRole('button', {
      name: '다음 활동',
      exact: true
    })).toBeVisible();
    await p.getByRole('button', {
      name: '다음 활동',
      exact: true
    }).click();
    await expect(p.getByRole('heading', {
      name: '배운 내용을 어떻게 활용하고 싶나요?',
      exact: true
    })).toBeVisible();
    await p.getByRole('button', {
      name: '두구두구',
      exact: true
    }).click();
    await expect(p.getByText('잠시 후, 정답을 공개합니다')).toBeVisible();
    await p.waitForTimeout(350);
    await p.screenshot({
      path: '/tmp/dorandoran-after-drumroll.png'
    });
    await expect(p.getByText('잠시 후, 정답을 공개합니다')).not.toBeVisible({
      timeout: 8000
    });
    await expect(p.getByText('정답', {
      exact: true
    })).toBeVisible();
    await p.waitForTimeout(350);
    await p.screenshot({
      path: '/tmp/dorandoran-after-correct.png'
    });
    const boxes = await p.locator('footer button:visible').evaluateAll(es => es.map(e => {
      const r = e.getBoundingClientRect();
      return {
        name: e.innerText,
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height
      };
    }));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i],
        b = boxes[j];
      expect(a.x + a.w <= b.x + 1 || b.x + b.w <= a.x + 1 || a.y + a.h <= b.y + 1 || b.y + b.h <= a.y + 1).toBe(true);
    }
    await health(p);
    const board = await c.newPage();
    board.on('pageerror', e => errors.push(e.message));
    await board.goto(base + '/live?s=' + sid);
    await board.getByRole('button', {
      name: '참여 QR 보기',
      exact: true
    }).click();
    await expect(board.getByRole('dialog', {
      name: '수업 참여 QR'
    })).toBeVisible();
    await expect.poll(() => board.locator('.participation-qr svg').evaluate(e => {
      const r = e.getBoundingClientRect();
      return !!document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('[role="dialog"]');
    })).toBe(true);
    await board.waitForTimeout(350);
    await board.screenshot({
      path: '/tmp/dorandoran-after-board-qr.png'
    });
    await board.getByRole('button', {
      name: '참여 QR 닫기'
    }).click();
    await health(board);
    await p.getByRole('button', {
      name: '슬라이드로 돌아가기',
      exact: true
    }).click();
    await expect(p.getByAltText('슬라이드 3')).toBeVisible();
    await expect(board.getByAltText('슬라이드 3')).toBeVisible();
    await db.ref('sessions/' + sid).update({
      currentMode: 'poll',
      currentQuestion: 'many'
    });
    await expect(p.getByRole('button', {
      name: '다음 보기 페이지'
    })).toBeVisible();
    await p.getByRole('button', {
      name: '다음 보기 페이지'
    }).click();
    await expect.poll(async () => (await db.ref('sessions/' + sid + '/questions/many/displayPage').get()).val()).toBe(1);
    // Choice letters and answer text are now separate accessible spans.
    const firstLabel = await p.locator('.classroom-option-label').first().locator('span').last().innerText();
    const firstLetter = await p.locator('.classroom-option-label').first().locator('span').first().innerText();
    await expect(board.getByText(firstLabel, {
      exact: true
    })).toBeVisible();
    await expect(board.locator('.classroom-option-label').first().locator('span').first()).toHaveText(firstLetter);
    await expect(board.getByText('1. 다양한 관점에서 생각해볼 수 있어요', {
      exact: true
    })).not.toBeVisible();
    await p.waitForTimeout(350);
    await p.screenshot({
      path: '/tmp/dorandoran-after-many.png'
    });
    await health(p);
    evidence.push({
      desktop: 'PASS',
      footerButtons: boxes.length,
      qrTopLayer: true,
      slideReturn: 3,
      pagedOptions: true
    });
    await c.close();
  } finally {
    await browser.close();
  }
  for (const engine of process.env.QA_WEBKIT === 'false' ? ['chrome'] : ['chrome', 'webkit']) {
    const b = engine === 'chrome' ? await chromium.launch(process.platform === 'darwin' ? {
      channel: 'chrome'
    } : {}) : await webkit.launch();
    try {
      for (const width of [320, 360, 390, 430]) {
        const c = await b.newContext({
          viewport: {
            width,
            height: 844
          },
          isMobile: true,
          hasTouch: true
        });
        const p = await c.newPage();
        p.on('pageerror', e => errors.push(engine + ':' + e.message));
        await db.ref('sessions/' + sid).update({
          currentMode: 'quiz',
          currentQuestion: 'q1',
          'questions/q1/revealedAt': null,
          'questions/q1/activatedAt': Date.now(),
          timer: null
        });
        const raw = (await db.ref('sessions/' + sid + '/questions/q1').get()).val();
        await db.ref('sessions/' + sid + '/publicQuestions/q1').set({
          title: raw.title,
          type: raw.type,
          options: raw.options,
          order: raw.order,
          activatedAt: raw.activatedAt
        });
        await p.goto(base + '/?s=' + sid);
        await p.getByPlaceholder('닉네임 입력').fill('모바일' + width);
        await p.getByRole('button', {
          name: '참여하기',
          exact: true
        }).click();
        await expect(p.getByRole('button', {
          name: '학습자 설정'
        })).toBeVisible();
        await expect(p.getByRole('button', {
          name: '손들기',
          exact: true
        })).toBeVisible();
        await expect(p.getByRole('button', {
          name: '수업 질문',
          exact: true
        })).toBeVisible();
        await health(p);
        await p.getByRole('button', {
          name: '학습자 설정'
        }).click();
        await expect(p.getByRole('button', {
          name: '닉네임 변경'
        })).toBeVisible();
        await p.getByRole('button', {
          name: '설정 닫기'
        }).click();
        await p.getByRole('button', {
          name: '참여 도구 더보기',
          exact: true
        }).click();
        await expect(p.getByText('1:1 도움', {
          exact: true
        })).toBeVisible();
        await p.waitForTimeout(350);
        await p.screenshot({
          path: `/tmp/dorandoran-after-${engine}-${width}.png`
        });
        await p.getByRole('button', {
          name: '더보기 닫기'
        }).click();
        await p.getByRole('button', {
          name: '수업 질문',
          exact: true
        }).click();
        await expect(p.getByPlaceholder('질문을 입력하세요')).toBeVisible();
        expect(await p.getByPlaceholder('질문을 입력하세요').evaluate(e => getComputedStyle(e).fontSize)).toBe('16px');
        await p.evaluate(() => {
          Object.defineProperty(window.visualViewport, 'height', {
            get: () => 440,
            configurable: true
          });
          window.visualViewport.dispatchEvent(new Event('resize'));
        });
        await expect.poll(() => p.getByRole('button', {
          name: '질문 보내기',
          exact: true
        }).evaluate(e => e.getBoundingClientRect().bottom)).toBeLessThanOrEqual(440);
        await p.getByPlaceholder('질문을 입력하세요').fill('모바일 화면 점검 질문');
        await p.getByRole('button', {
          name: '질문 보내기',
          exact: true
        }).click();
        await expect(p.getByPlaceholder('질문을 입력하세요')).toHaveValue('');
        await p.getByRole('button', {
          name: '수업 질문 닫기'
        }).click();
        await p.evaluate(() => {
          delete window.visualViewport.height;
          window.visualViewport.dispatchEvent(new Event('resize'));
        });
        await p.getByRole('button', {
          name: /수업에서 바로 활용할 수 있어요/
        }).click();
        const vote = await p.evaluate(async () => {
          const {
            auth
          } = await import('/src/lib/auth-session.js');
          return auth.currentUser.uid;
        });
        await expect.poll(async () => (await db.ref('sessions/' + sid + '/questions/q1/votes/' + vote + '/value').get()).val()).toBe('수업에서 바로 활용할 수 있어요');
        await health(p);
        evidence.push({
          engine,
          width,
          result: 'PASS'
        });
        await c.close();
      }
    } finally {
      await b.close();
    }
  }
  expect(errors).toEqual([]);
  console.log(JSON.stringify({
    result: 'PASS',
    evidence,
    errors
  }));
  process.exit(0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
