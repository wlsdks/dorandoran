// Real instructor → staff-context board → Chrome390/WebKit320/Chrome360 quiz regression.
const fs = require('fs'),
  path = require('path'),
  {
    createRequire
  } = require('module');
const root = path.resolve(__dirname, '../..'),
  req = createRequire(root + '/package.json'),
  dep = createRequire(root + '/functions/package.json'),
  {
    chromium,
    webkit,
    expect
  } = req('@playwright/test');
if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('Local demo Auth/Database emulators required');
const {
    initializeApp,
    deleteApp
  } = dep('firebase-admin/app'),
  {
    getDatabase
  } = dep('firebase-admin/database'),
  {
    getAuth
  } = dep('firebase-admin/auth');
const app = initializeApp({
    projectId: 'demo-dorandoran',
    databaseURL: 'https://demo-dorandoran.firebaseio.com'
  }, 'quiz-matrix'),
  db = getDatabase(app),
  sid = 'qa_quiz_matrix',
  base = 'http://127.0.0.1:5175',
  dir = path.join('/tmp', 'dorandoran-quiz-matrix-' + process.pid);
fs.mkdirSync(dir, {
  recursive: true
});
let chrome, wk;
const pages = [],
  screenshots = [],
  checks = [],
  unexpected = [],
  expectedDenials = [],
  uids = [];
let permitDenial = null;
async function shot(page, key) {
  await page.waitForTimeout(350);
  const file = key + '.png';
  await page.screenshot({
    path: path.join(dir, file)
  });
  screenshots.push({
    key,
    file
  });
}
function watch(page, role) {
  page.on('pageerror', e => unexpected.push({
    role,
    error: e.message
  }));
  page.on('console', m => {
    if (!['warning', 'error'].includes(m.type())) return;
    if (role === permitDenial && /permission[_ -]?denied/i.test(m.text())) expectedDenials.push(m.text());else unexpected.push({
      role,
      type: m.type(),
      error: m.text()
    });
  });
  pages.push({
    page,
    role
  });
}
async function stored(qid, uid) {
  return (await db.ref(`sessions/${sid}/questions/${qid}/votes/${uid}`).get()).val();
}
async function offline(page, value) {
  await page.evaluate(async value => {
    const {
        db
      } = await import('/src/lib/firebase.js'),
      sdk = await import('/node_modules/.vite/deps/firebase_database.js');
    value ? sdk.goOffline(db) : sdk.goOnline(db);
  }, value);
}
(async () => {
  const options = ['함께 협업해요', '혼자만 결정해요'];
  const make = (title, order, extra = {}) => ({
    type: 'quiz',
    title,
    options,
    correctAnswer: options[0],
    points: 100,
    maxSpeedBonus: 0,
    betting: false,
    order,
    ...extra
  });
  const questions = {
    bet: make('자신감 배율과 2배 점수 이벤트', 0, {
      betting: true,
      event: {
        id: 'double-points',
        pointMultiplier: 2,
        label: '2배 점수'
      }
    }),
    timed: make('제한 시간이 있는 퀴즈', 1),
    queued: make('오프라인 답안이 남은 퀴즈', 2),
    next: make('다음 퀴즈에서 다시 참여해요', 3)
  };
  const fields = require(root + '/functions/public-question-fields.json');
  await db.ref('sessions/' + sid).set({
    creatorId: 'legacy_master',
    courseId: 'course_a',
    courseName: '퀴즈 집중 검수',
    createdAt: Date.now(),
    status: 'active',
    currentMode: 'quiz',
    currentQuestion: 'bet',
    questions,
    publicQuestions: Object.fromEntries(Object.entries(questions).map(([id, q]) => [id, Object.fromEntries(fields.filter(k => q[k] != null).map(k => [k, q[k]]))]))
  });
  chrome = await chromium.launch(process.platform === 'darwin' ? {
    channel: 'chrome'
  } : {});
  wk = await webkit.launch();
  const tc = await chrome.newContext({
      viewport: {
        width: 1366,
        height: 768
      }
    }),
    teacher = await tc.newPage();
  watch(teacher, 'teacher');
  await teacher.goto(base + '/admin');
  await teacher.getByPlaceholder('아이디').fill('qa-master');
  await teacher.getByPlaceholder('비밀번호').fill('TestFixture-Only-Strong8');
  await teacher.getByRole('button', {
    name: '로그인',
    exact: true
  }).click();
  await expect(teacher.getByRole('button', {
    name: '내 클래스',
    exact: true
  })).toBeVisible();
  await teacher.goto(base + '/admin?s=' + sid);
  await teacher.getByRole('button', {
    name: '발표 모드',
    exact: true
  }).click();
  const board = await tc.newPage();
  watch(board, 'board');
  await board.goto(base + '/live?s=' + sid);
  const cdp = await tc.newCDPSession(board);
  await cdp.send('Emulation.setCPUThrottlingRate', {
    rate: 6
  });
  const learners = [];
  for (const [b, width, label] of [[chrome, 390, 'chrome'], [wk, 320, 'webkit'], [chrome, 360, 'unanswered']]) {
    const c = await b.newContext({
        viewport: {
          width,
          height: 844
        },
        isMobile: true,
        hasTouch: true,
        recordVideo: {
          dir: path.join(dir, 'raw-' + label),
          size: {
            width,
            height: 844
          }
        }
      }),
      p = await c.newPage();
    watch(p, label);
    await p.goto(base + '/?s=' + sid);
    await p.getByPlaceholder('닉네임 입력').fill(label === 'chrome' ? '참여하늘' : label === 'webkit' ? '참여도윤' : '늦은참여');
    await p.getByRole('button', {
      name: '참여하기',
      exact: true
    }).click();
    await expect(p.getByRole('button', {
      name: '학습자 설정'
    })).toBeVisible();
    const uid = await p.evaluate(async () => (await import('/src/lib/auth-session.js')).auth.currentUser.uid);
    uids.push(uid);
    learners.push({
      p,
      uid,
      label,
      c
    });
  }
  const [correct, wrong, late] = learners;
  await expect(board.getByText(/^답을 선택해주세요/)).toBeVisible();
  await expect(board.locator('.poll-column-value')).toHaveCount(0);
  await expect(correct.p.getByRole('button', {
    name: /함께 협업해요/
  })).toBeVisible();
  await correct.p.getByRole('button', {
    name: /2x.*자신/
  }).click();
  await correct.p.getByRole('button', {
    name: /1x.*안전/
  }).click();
  await correct.p.getByRole('button', {
    name: /2x.*자신/
  }).click();
  await wrong.p.getByRole('button', {
    name: /3x.*올인/
  }).click();
  await correct.p.getByRole('button', {
    name: /함께 협업해요/
  }).click();
  await wrong.p.getByRole('button', {
    name: /혼자만 결정해요/
  }).click();
  await expect.poll(() => stored('bet', correct.uid)).toMatchObject({
    value: options[0],
    bet: 2
  });
  await expect.poll(() => stored('bet', wrong.uid)).toMatchObject({
    value: options[1],
    bet: 3
  });
  await shot(correct.p, '01-bet-ack-chrome');
  await shot(wrong.p, '02-bet-ack-webkit');
  checks.push('numeric bet2/3 submitted and acknowledged');
  await expect(board.locator('.poll-column-value')).toHaveCount(2);
  await expect(board.locator('[data-correct="true"]')).toHaveCount(0);
  await expect.poll(async () => (await db.ref(`sessions/${sid}/publicQuizAggregates/bet/total`).get()).val()).toBe(2);
  await teacher.getByRole('button', {
    name: '정답 공개',
    exact: true
  }).click();
  await expect.poll(async () => (await db.ref(`sessions/${sid}/scores/${correct.uid}/total`).get()).val()).toBe(400);
  await expect.poll(async () => (await db.ref(`sessions/${sid}/scores/${wrong.uid}/total`).get()).val()).toBe(-60);
  await expect(board.locator('.poll-column-value')).toHaveCount(2);
  await expect(correct.p.getByText('정답!', {
    exact: true
  })).toBeVisible();
  await expect(wrong.p.getByText('오답', {
    exact: true
  })).toBeVisible();
  await expect(late.p.getByText('이번 라운드에 참여하지 않았습니다')).toBeVisible();
  await expect(correct.p.getByText('+400점', { exact: true })).toBeVisible();
  const toast = correct.p.getByRole('status').filter({ hasText: '첫 정답' });
  await expect(toast).toBeVisible();
  const [toastBounds, pointsBounds, betBounds] = await Promise.all([
    toast.boundingBox(), correct.p.getByText('+400점', { exact: true }).boundingBox(),
    board.getByLabel('베팅 분포', { exact: true }).boundingBox()
  ]);
  expect(toastBounds.y + toastBounds.height <= pointsBounds.y || pointsBounds.y + pointsBounds.height <= toastBounds.y).toBe(true);
  expect(betBounds.y + betBounds.height).toBeLessThan(768);
  await shot(board, '03-board-revealed-50-50');
  await shot(correct.p, '04-correct-400');
  await shot(wrong.p, '05-wrong-negative-60');
  checks.push('2x event+bet grades400/-60 and late learner is not graded');
  await teacher.getByRole('button', {
    name: '다음 활동',
    exact: true
  }).click();
  await expect(correct.p.getByRole('button', {
    name: /함께 협업해요/
  })).toBeVisible();
  // Exercise the dashboard TimerRing expiry, which must retain the server deadline.
  await teacher.keyboard.press('Escape');
  const deadline = Date.now() + 4000;
  await db.ref('sessions/' + sid + '/timer').set({
    running: true,
    duration: 4,
    endTime: deadline
  });
  await correct.p.getByRole('button', {
    name: /함께 협업해요/
  }).click();
  await wrong.p.getByRole('button', {
    name: /함께 협업해요/
  }).click();
  await expect.poll(() => stored('timed', correct.uid)).not.toBe(null);
  await expect.poll(() => stored('timed', wrong.uid)).not.toBe(null);
  await expect(late.p.getByText('시간이 종료되었습니다')).toBeVisible({
    timeout: 10000
  });
  await expect(late.p.getByRole('button', {
    name: /함께 협업해요/
  })).toBeDisabled();
  await expect.poll(async () => (await db.ref(`sessions/${sid}/timer`).get()).val()).toMatchObject({ running: false, endTime: deadline });
  await late.p.reload();
  await expect(late.p.getByText('시간이 종료되었습니다')).toBeVisible();
  await expect(late.p.getByRole('button', { name: /함께 협업해요/ })).toBeDisabled();
  expect(await stored('timed', late.uid)).toBeNull();
  await shot(late.p, '06-timer-expired-unanswered');
  await teacher.getByRole('button', {
    name: '정답 공개',
    exact: true
  }).last().click();
  await expect.poll(async () => (await db.ref(`sessions/${sid}/scores/${correct.uid}/total`).get()).val()).toBe(500);
  await expect.poll(async () => (await db.ref(`sessions/${sid}/scores/${wrong.uid}/total`).get()).val()).toBe(40);
  checks.push('timer expiry locks late input and scores500/40');
  await teacher.getByRole('button', { name: '발표 모드', exact: true }).click();
  await teacher.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await db.ref(`sessions/${sid}/currentQuestion`).get()).val()).toBe('bet');
  await expect(board.locator('.poll-column-value')).toHaveCount(2);
  expect((await db.ref(`sessions/${sid}/scores/${correct.uid}/total`).get()).val()).toBe(500);
  await teacher.keyboard.press('ArrowRight');
  await teacher.getByRole('button', {
    name: '다음 활동',
    exact: true
  }).click();
  await expect(correct.p.getByRole('button', {
    name: /함께 협업해요/
  })).toBeVisible();
  await offline(correct.p, true);
  await correct.p.getByRole('button', {
    name: /함께 협업해요/
  }).click();
  await expect(correct.p.getByText('답안을 보내는 중...', {
    exact: true
  })).toBeVisible();
  expect(await stored('queued', correct.uid)).toBeNull();
  await teacher.getByRole('button', {
    name: '다음 활동',
    exact: true
  }).click();
  permitDenial = 'chrome';
  await offline(correct.p, false);
  await expect(correct.p.getByRole('heading', {
    name: '다음 퀴즈에서 다시 참여해요',
    exact: true
  })).toBeVisible();
  await expect(correct.p.getByRole('button', {
    name: /함께 협업해요/
  })).toBeEnabled();
  await correct.p.getByRole('button', {
    name: /함께 협업해요/
  }).click();
  await expect.poll(() => stored('next', correct.uid)).not.toBe(null);
  expect(await stored('queued', correct.uid)).toBeNull();
  await shot(correct.p, '07-next-question-recovery');
  permitDenial = null;
  checks.push('old offline vote denied after question switch; next answer recovered');
  await teacher.getByRole('button', {
    name: '두구두구',
    exact: true
  }).click();
  await expect(board.getByText('잠시 후, 정답을 공개합니다')).toBeVisible();
  await expect.poll(async () => (await db.ref(`sessions/${sid}/questions/next/awardedAt`).get()).exists(), {
    timeout: 12000
  }).toBe(true);
  await expect.poll(async () => (await db.ref(`sessions/${sid}/scores/${correct.uid}/total`).get()).val()).toBe(600);
  await expect(correct.p.getByText('정답!', {
    exact: true
  })).toBeVisible();
  await shot(board, '08-final-drumroll-result');
  await shot(correct.p, '09-final-score600');
  expect(unexpected).toEqual([]);
  console.log(JSON.stringify({
    result: 'PASS',
    checks,
    unexpected,
    expectedDenials,
    screenshots,
    finalScores: [600, 40],
    cpuSlowdown: 6
  }));
})().catch(async e => {
  console.error(e);
  for (const {
    page,
    role
  } of pages) {
    try {
      await page.screenshot({
        path: path.join(dir, 'FAIL-' + role + '.png')
      });
      console.log(role, (await page.locator('body').innerText()).slice(-2500));
    } catch {}
  }
  process.exitCode = 1;
}).finally(async () => {
  await chrome?.close();
  await wk?.close();
  await db.ref('sessions/' + sid).remove();
  if (uids.length) await getAuth(app).deleteUsers(uids);
  await deleteApp(app);
  fs.writeFileSync(path.join(dir, 'matrix-errors.json'), JSON.stringify({
    unexpected,
    expectedDenials,
    checks,
    screenshots
  }, null, 2));
  process.exit(process.exitCode || 0);
});
