if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000') throw new Error('부하/정리 도구는 로컬 demo 에뮬레이터에서만 실행하세요.');
/**
 * DoranDoran — 200명 동시접속 부하 테스트
 *
 * 테스트 시나리오:
 * 1. 200명 학생이 세션에 순차 입장 (5명씩 배치)
 * 2. 전원 입장 후 투표 시뮬레이션
 * 3. 리액션 시뮬레이션
 * 4. 실시간 리스너 지연 측정
 * 5. 정리 (테스트 데이터 삭제)
 *
 * 사용법: node tests/load-test.mjs [sessionId] [userCount]
 */

import { initializeApp, deleteApp } from 'firebase/app';
import { getDatabase, ref, set, push, onValue, update, remove, serverTimestamp } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCsRs1BTT1NphOpbkoAwKn7rnrdQk16R2I",
  authDomain: "jinan-6c884.firebaseapp.com",
  databaseURL: "http://127.0.0.1:9000/?ns=demo-dorandoran",
  projectId: "demo-dorandoran",
  storageBucket: "jinan-6c884.firebasestorage.app",
  messagingSenderId: "956378670080",
  appId: "1:956378670080:web:2147d0766564dd00dde4e5"
};

// --- Config ---
const SESSION_ID = process.argv[2] || 'load_test_session';
const USER_COUNT = parseInt(process.argv[3]) || 200;
const BATCH_SIZE = 10; // 한 번에 입장시킬 학생 수
const VOTE_OPTIONS = ['A', 'B', 'C', 'D'];
const REACTION_TYPES = ['thumbsUp', 'fire', 'heart', 'laugh', 'clap'];

// --- State ---
const apps = [];
const dbs = [];
const listeners = [];
const results = {
  joinLatencies: [],
  voteLatencies: [],
  listenerLatencies: [],
  reactionLatencies: [],
  errors: [],
};

function log(msg) {
  process.stdout.write(`[${new Date().toLocaleTimeString()}] ${msg}\n`);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function genId() {
  return 'lt_' + Math.random().toString(36).slice(2, 10);
}

// --- Phase 1: Create connections ---
async function createConnections() {
  log(`📡 Firebase 앱 ${USER_COUNT}개 생성 중...`);
  for (let i = 0; i < USER_COUNT; i++) {
    const app = initializeApp(firebaseConfig, `loadtest_${i}`);
    const db = getDatabase(app);
    apps.push(app);
    dbs.push(db);
  }
  log(`✅ ${USER_COUNT}개 앱 생성 완료`);
}

// --- Phase 2: Join session ---
async function joinSession() {
  log(`\n🚪 ${USER_COUNT}명 세션 입장 시작 (${BATCH_SIZE}명씩 배치)...`);

  const sessionRef = ref(dbs[0], `sessions/${SESSION_ID}`);

  // Create test session if it doesn't exist
  await set(sessionRef, {
    courseName: '부하테스트',
    status: 'active',
    currentMode: 'waiting',
    currentQuestion: null,
    createdAt: Date.now(),
  });

  // Create a test question
  const testQuestionId = 'lt_q1';
  await set(ref(dbs[0], `sessions/${SESSION_ID}/questions/${testQuestionId}`), {
    title: '부하 테스트 질문',
    type: 'choice',
    options: VOTE_OPTIONS,
  });

  let joined = 0;
  for (let batch = 0; batch < USER_COUNT; batch += BATCH_SIZE) {
    const batchEnd = Math.min(batch + BATCH_SIZE, USER_COUNT);
    const promises = [];

    for (let i = batch; i < batchEnd; i++) {
      const pid = `lt_user_${String(i).padStart(4, '0')}`;
      const nickname = `학생${i + 1}`;
      const start = performance.now();

      const p = set(ref(dbs[i], `sessions/${SESSION_ID}/participants/${pid}`), {
        nickname,
        joinedAt: Date.now(),
        online: true,
      }).then(() => {
        results.joinLatencies.push(performance.now() - start);
        joined++;
      }).catch(err => {
        results.errors.push({ phase: 'join', user: i, error: err.message });
      });

      promises.push(p);
    }

    await Promise.all(promises);

    if (joined % 50 === 0 || joined === USER_COUNT) {
      const avg = results.joinLatencies.slice(-BATCH_SIZE).reduce((a, b) => a + b, 0) / BATCH_SIZE;
      log(`  입장: ${joined}/${USER_COUNT} (배치 평균 ${avg.toFixed(0)}ms)`);
    }
  }

  log(`✅ 전원 입장 완료 — 평균 ${avg(results.joinLatencies)}ms, 최대 ${max(results.joinLatencies)}ms`);
  return testQuestionId;
}

// --- Phase 3: Test real-time listener latency ---
async function testListenerLatency() {
  log(`\n📡 실시간 리스너 지연 측정 중...`);

  return new Promise((resolve) => {
    let received = 0;
    const writeTime = performance.now();

    // 50개 클라이언트에서 리스너 설정
    const sampleSize = Math.min(50, USER_COUNT);
    for (let i = 0; i < sampleSize; i++) {
      const unsub = onValue(ref(dbs[i], `sessions/${SESSION_ID}/currentMode`), (snap) => {
        if (snap.val() === 'poll') {
          results.listenerLatencies.push(performance.now() - writeTime);
          received++;
          if (received >= sampleSize) {
            listeners.forEach(u => u());
            resolve();
          }
        }
      });
      listeners.push(unsub);
    }

    // 잠시 후 모드 변경 트리거
    setTimeout(async () => {
      await update(ref(dbs[0], `sessions/${SESSION_ID}`), { currentMode: 'poll', currentQuestion: 'lt_q1' });
    }, 1000);

    // 타임아웃 안전장치
    setTimeout(() => {
      log(`  ⚠️ ${received}/${sampleSize} 수신 (일부 미수신)`);
      listeners.forEach(u => u());
      resolve();
    }, 10000);
  });
}

// --- Phase 4: Vote simulation ---
async function simulateVoting(questionId) {
  log(`\n🗳️ ${USER_COUNT}명 동시 투표 시작...`);

  const promises = [];
  for (let i = 0; i < USER_COUNT; i++) {
    const pid = `lt_user_${String(i).padStart(4, '0')}`;
    const option = VOTE_OPTIONS[i % VOTE_OPTIONS.length];
    const start = performance.now();

    // 약간의 랜덤 딜레이 (실제 사용 패턴 시뮬레이션)
    const delay = Math.random() * 3000; // 0~3초

    const p = sleep(delay).then(() =>
      set(ref(dbs[i], `sessions/${SESSION_ID}/questions/${questionId}/votes/${pid}`), {
        value: option,
        timestamp: Date.now(),
      })
    ).then(() => {
      results.voteLatencies.push(performance.now() - start - delay);
    }).catch(err => {
      results.errors.push({ phase: 'vote', user: i, error: err.message });
    });

    promises.push(p);
  }

  await Promise.all(promises);
  log(`✅ 투표 완료 — 평균 ${avg(results.voteLatencies)}ms, 최대 ${max(results.voteLatencies)}ms`);
}

// --- Phase 5: Reaction burst ---
async function simulateReactions() {
  log(`\n🎉 리액션 폭발 테스트 (${USER_COUNT}명 × 3회)...`);

  for (let round = 0; round < 3; round++) {
    const promises = [];
    for (let i = 0; i < USER_COUNT; i++) {
      const type = REACTION_TYPES[Math.floor(Math.random() * REACTION_TYPES.length)];
      const start = performance.now();

      const p = push(ref(dbs[i], `sessions/${SESSION_ID}/reactions`), {
        type,
        timestamp: Date.now(),
      }).then(() => {
        results.reactionLatencies.push(performance.now() - start);
      }).catch(err => {
        results.errors.push({ phase: 'reaction', user: i, error: err.message });
      });

      promises.push(p);
    }

    await Promise.all(promises);
    log(`  라운드 ${round + 1}/3 완료 — 평균 ${avg(results.reactionLatencies.slice(-USER_COUNT))}ms`);
    await sleep(500);
  }

  log(`✅ 리액션 완료 — 총 ${results.reactionLatencies.length}건, 평균 ${avg(results.reactionLatencies)}ms`);
}

// --- Phase 6: Cleanup ---
async function cleanup() {
  log(`\n🧹 테스트 데이터 정리 중...`);

  try {
    await remove(ref(dbs[0], `sessions/${SESSION_ID}`));
    log(`✅ 세션 삭제 완료`);
  } catch (err) {
    log(`⚠️ 정리 실패: ${err.message}`);
  }

  // Close all Firebase apps
  log(`📡 ${USER_COUNT}개 Firebase 연결 종료 중...`);
  for (const app of apps) {
    try { await deleteApp(app); } catch { /* ignore */ }
  }
  log(`✅ 연결 종료 완료`);
}

// --- Report ---
function printReport() {
  log(`\n${'='.repeat(60)}`);
  log(`📊 부하 테스트 결과 — ${USER_COUNT}명 동시접속`);
  log(`${'='.repeat(60)}`);

  log(`\n[입장]`);
  log(`  참여자: ${results.joinLatencies.length}/${USER_COUNT}`);
  log(`  평균: ${avg(results.joinLatencies)}ms`);
  log(`  P95:  ${p95(results.joinLatencies)}ms`);
  log(`  최대: ${max(results.joinLatencies)}ms`);

  log(`\n[실시간 리스너]`);
  log(`  수신: ${results.listenerLatencies.length}개`);
  log(`  평균: ${avg(results.listenerLatencies)}ms`);
  log(`  P95:  ${p95(results.listenerLatencies)}ms`);
  log(`  최대: ${max(results.listenerLatencies)}ms`);

  log(`\n[투표]`);
  log(`  성공: ${results.voteLatencies.length}/${USER_COUNT}`);
  log(`  평균: ${avg(results.voteLatencies)}ms`);
  log(`  P95:  ${p95(results.voteLatencies)}ms`);
  log(`  최대: ${max(results.voteLatencies)}ms`);

  log(`\n[리액션]`);
  log(`  성공: ${results.reactionLatencies.length}건`);
  log(`  평균: ${avg(results.reactionLatencies)}ms`);
  log(`  P95:  ${p95(results.reactionLatencies)}ms`);
  log(`  최대: ${max(results.reactionLatencies)}ms`);

  log(`\n[에러]`);
  log(`  총: ${results.errors.length}건`);
  if (results.errors.length > 0) {
    const byPhase = {};
    results.errors.forEach(e => { byPhase[e.phase] = (byPhase[e.phase] || 0) + 1; });
    Object.entries(byPhase).forEach(([phase, count]) => {
      log(`  ${phase}: ${count}건`);
    });
    // Show first few errors
    results.errors.slice(0, 5).forEach(e => {
      log(`  - [${e.phase}] user${e.user}: ${e.error}`);
    });
  }

  log(`\n${'='.repeat(60)}`);

  // Pass/Fail judgment
  const joinOk = results.joinLatencies.length >= USER_COUNT * 0.95;
  const voteOk = results.voteLatencies.length >= USER_COUNT * 0.95;
  const latencyOk = parseFloat(p95(results.voteLatencies)) < 3000;
  const listenerOk = parseFloat(avg(results.listenerLatencies)) < 2000;

  log(`\n판정:`);
  log(`  입장 성공률 ≥95%: ${joinOk ? '✅ PASS' : '❌ FAIL'} (${(results.joinLatencies.length / USER_COUNT * 100).toFixed(1)}%)`);
  log(`  투표 성공률 ≥95%: ${voteOk ? '✅ PASS' : '❌ FAIL'} (${(results.voteLatencies.length / USER_COUNT * 100).toFixed(1)}%)`);
  log(`  투표 P95 <3초:    ${latencyOk ? '✅ PASS' : '❌ FAIL'} (${p95(results.voteLatencies)}ms)`);
  log(`  리스너 평균 <2초:  ${listenerOk ? '✅ PASS' : '❌ FAIL'} (${avg(results.listenerLatencies)}ms)`);

  const allPass = joinOk && voteOk && latencyOk && listenerOk;
  log(`\n  ${allPass ? '🎉 ALL PASS — 200명 동시접속 준비 완료!' : '⚠️ 일부 실패 — 위 결과를 검토하세요'}`);
  log('');
}

// --- Utils ---
function avg(arr) { return arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(0) : '0'; }
function max(arr) { return arr.length ? Math.max(...arr).toFixed(0) : '0'; }
function p95(arr) {
  if (!arr.length) return '0';
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.95)].toFixed(0);
}

// --- Main ---
async function main() {
  log(`🚀 DoranDoran 부하 테스트 시작 — ${USER_COUNT}명 동시접속\n`);

  try {
    await createConnections();
    const questionId = await joinSession();
    await sleep(2000); // Let connections stabilize
    await testListenerLatency();
    await sleep(1000);
    await simulateVoting(questionId);
    await sleep(1000);
    await simulateReactions();
    printReport();
  } catch (err) {
    log(`\n❌ 테스트 실패: ${err.message}`);
    console.error(err);
  } finally {
    await cleanup();
  }
}

main();
