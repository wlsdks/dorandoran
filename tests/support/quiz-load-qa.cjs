/** 200개의 실제 Web SDK 연결. 운영 프로젝트·과금 서비스는 사용하지 않는다. */
const assert = require('node:assert/strict');
const {
  createRequire
} = require('node:module');
const {
  setTimeout: pause
} = require('node:timers/promises');
const {
  initializeApp,
  deleteApp
} = require('firebase/app');
const {
  getAuth,
  connectAuthEmulator,
  signInAnonymously
} = require('firebase/auth');
const {
  getDatabase,
  connectDatabaseEmulator,
  forceWebSockets,
  ref,
  set,
  get,
  onValue,
  serverTimestamp,
  goOffline,
  goOnline
} = require('firebase/database');
const dep = createRequire(require('node:path').resolve(__dirname, '../../functions/package.json'));
if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('Local demo Auth/Database emulators required');
const adminApp = dep('firebase-admin/app').initializeApp({
  projectId: 'demo-dorandoran',
  databaseURL: 'https://demo-dorandoran.firebaseio.com'
}, 'load-qa');
const adminDb = dep('firebase-admin/database').getDatabase(adminApp);
const adminAuth = dep('firebase-admin/auth').getAuth(adminApp);
const {
  mapConcurrent
} = require('../../functions/concurrency');
const sid = 'qa_quiz_load_200',
  count = 200,
  rounds = 3;
const {
  chromium,
  expect
} = require('@playwright/test');
let browser, teacher;
if (!Number.isInteger(rounds) || rounds < 1 || rounds > 20) throw new Error('Load QA rounds must be 1..20');
const clients = [],
  errors = [],
  durations = [],
  off = [];
async function waitFor(check, label) {
  for (let i = 0; i < 1200; i++) {
    if (check()) return;
    if (errors.length) throw new Error(JSON.stringify(errors));
    await pause(25);
  }
  throw new Error(`Timed out: ${label}`);
}
forceWebSockets();
(async () => {
  const questions = Object.fromEntries(Array.from({
    length: rounds
  }, (_, i) => [`q${i}`, {
    title: '200명 퀴즈 공개와 점수',
    type: 'quiz',
    options: ['A', 'B'],
    correctAnswer: 'A',
    points: 100,
    maxSpeedBonus: 0,
    betting: false,
    order: i
  }]));
  await adminDb.ref(`sessions/${sid}`).set({
    creatorId: 'legacy_master',
    createdAt: Date.now(),
    courseName: '200명 로컬 검증',
    status: 'active',
    currentMode: 'quiz',
    currentQuestion: 'q0',
    questions,
    publicQuestions: Object.fromEntries(Object.entries(questions).map(([id, {
      correctAnswer: _answer,
      ...q
    }]) => [id, q]))
  });
  const start = performance.now();
  await mapConcurrent(Array.from({
    length: count
  }, (_, i) => i), 20, async i => {
    const app = initializeApp({
      projectId: 'demo-dorandoran',
      apiKey: 'demo-key',
      databaseURL: 'https://demo-dorandoran.firebaseio.com'
    }, `load-${i}`);
    const auth = getAuth(app);
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
      disableWarnings: true
    });
    const db = getDatabase(app);
    connectDatabaseEmulator(db, '127.0.0.1', 9000);
    const client = {
      app,
      auth,
      db,
      nickname: `참여${i}`,
      totals: {},
      connected: false,
      roster: 0,
      meta: null
    };
    clients.push(client);
    const {
      user
    } = await signInAnonymously(auth);
    client.uid = user.uid;
    await set(ref(db, `sessions/${sid}/participants/${user.uid}`), {
      nickname: client.nickname,
      joinedAt: serverTimestamp(),
      connections: {
        qa: true
      }
    });
  });
  await Promise.all(clients.map(async client => {
    const failure = error => errors.push(error.message);
    off.push(onValue(ref(client.db, '.info/connected'), snapshot => {
      client.connected = snapshot.val() === true;
    }, failure));
    off.push(onValue(ref(client.db, `sessions/${sid}/participants`), snapshot => {
      client.roster = snapshot.size;
    }, failure));
    off.push(onValue(ref(client.db, `sessions/${sid}/currentQuestion`), snapshot => {
      client.meta = snapshot.val();
    }, failure));
  }));
  await waitFor(() => clients.every(c => c.connected && c.roster === count && c.meta === 'q0'), '200 connected and full roster');
  const joinMs = Math.round(performance.now() - start);
  console.log(JSON.stringify({
    phase: 'joined',
    anonymousClients: clients.length,
    simultaneousConnections: clients.filter(c => c.connected).length,
    joinMs
  }));
  browser = await chromium.launch(process.platform === 'darwin' ? {
    channel: 'chrome'
  } : {});
  teacher = await browser.newPage();
  await teacher.goto('http://127.0.0.1:5175/admin');
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
  await teacher.goto('http://127.0.0.1:5175/admin?s=' + sid);
  for (let round = 0; round < rounds; round++) {
    const qid = `q${round}`,
      roundOff = [],
      started = performance.now();
    await adminDb.ref(`sessions/${sid}/currentQuestion`).set(qid);
    clients.forEach(client => {
      client.openedResults = false;
      roundOff.push(onValue(ref(client.db, `sessions/${sid}/publicQuestions/${qid}/revealedAt`), snapshot => {
        client.revealed = !!snapshot.val();
        if (!client.revealed || client.openedResults) return;
        client.openedResults = true;
        roundOff.push(onValue(ref(client.db, `sessions/${sid}/questions/${qid}/votes`), votesSnapshot => {
          const votes = Object.values(votesSnapshot.val() || {});
          client.totals[qid] = {
            count: votes.length,
            a: votes.filter(v => v.value === 'A').length,
            b: votes.filter(v => v.value === 'B').length
          };
        }, error => errors.push(error.message)));
      }, error => errors.push(error.message)));
      roundOff.push(onValue(ref(client.db, `sessions/${sid}/scores/${client.uid}`), snapshot => {
        client.score = snapshot.val()?.total ?? 0;
      }, error => errors.push(error.message)));
    });
    try {
      await waitFor(() => clients.every(c => c.meta === qid), 'question and vote listener');
      await mapConcurrent(clients, 200, (client, i) => set(ref(client.db, `sessions/${sid}/questions/${qid}/votes/${client.uid}`), {
        value: i % 2 ? 'A' : 'B',
        nickname: client.nickname,
        timestamp: serverTimestamp()
      }));
      assert.equal(clients.filter(c => c.openedResults).length, 0, 'quiz aggregate must remain hidden until reveal');
      await teacher.getByRole('button', {
        name: '정답 공개',
        exact: true
      }).last().click();
      await waitFor(() => clients.every((c, index) => c.score === (index % 2 ? (round + 1) * 100 : 0)), 'all individual scores');
      await waitFor(() => clients.every(c => c.totals[qid]?.count === count && c.totals[qid].a === 100 && c.totals[qid].b === 100), 'full aggregate on every client');
      const stored = (await adminDb.ref(`sessions/${sid}/questions/${qid}/votes`).get()).numChildren();
      assert.equal(stored, 200);
      durations.push(Math.round(performance.now() - started));
      console.log(JSON.stringify({
        phase: 'round',
        round: round + 1,
        writes: stored,
        allClientsSee: '100/100',
        burstToConvergenceMs: durations.at(-1)
      }));
    } finally {
      roundOff.forEach(stop => stop());
    }
  }
  // 연결이 끊겼던 학습자가 재접속해도 현재 활동과 전체 집계를 복구한다.
  const reconnect = clients.slice(0, 20),
    qid = `q${rounds - 1}`;
  reconnect.forEach(client => {
    off.push(onValue(ref(client.db, `sessions/${sid}/questions/${qid}/votes`), snapshot => {
      client.restored = snapshot.size;
    }, error => errors.push(error.message)));
    goOffline(client.db);
  });
  await waitFor(() => reconnect.every(c => !c.connected), 'offline');
  reconnect.forEach(client => {
    client.restored = 0;
    goOnline(client.db);
  });
  await waitFor(() => reconnect.every(c => c.connected && c.restored === 200), 'reconnect aggregate');
  assert.equal(errors.length, 0);
  console.log(JSON.stringify({
    result: 'PASS',
    type: 'quiz',
    hiddenBeforeReveal: true,
    correctStudents: 100,
    wrongStudents: 100,
    individuallyScored: 200,
    anonymousClients: 200,
    rounds,
    acknowledgedVotes: rounds * 200,
    allMobileAggregatesKept: true,
    reconnected: 20,
    joinMs,
    burstToConvergenceMs: {
      min: Math.min(...durations),
      max: Math.max(...durations),
      median: [...durations].sort((a, b) => a - b)[Math.floor(durations.length / 2)]
    },
    limits: 'Local emulator only; does not enforce production connection, signup quota or measure billing/real Wi-Fi.'
  }));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await browser?.close();
  off.forEach(stop => stop());
  clients.forEach(c => goOffline(c.db));
  await Promise.allSettled(clients.map(c => deleteApp(c.app)));
  const uids = clients.filter(c => c.uid).map(c => c.uid);
  if (uids.length) await adminAuth.deleteUsers(uids);
  await adminDb.ref(`sessions/${sid}`).remove();
  await dep('firebase-admin/app').deleteApp(adminApp);
  console.log(JSON.stringify({
    phase: 'cleanup',
    removedOnlyTestSession: sid,
    removedTestAuthUsers: uids.length
  }));
  process.exit(process.exitCode || 0);
});
