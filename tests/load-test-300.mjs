if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000') throw new Error('부하/정리 도구는 로컬 demo 에뮬레이터에서만 실행하세요.');
/**
 * DoranDoran — 300명 동시접속 전체 기능 부하 테스트
 *
 * 시나리오:
 * 1. 모든 질문 유형 포함 세션 자동 생성
 * 2. 300명 학생 입장
 * 3. 각 질문 유형별 투표/답변 시뮬레이션
 * 4. 텍스트 버블 부하 테스트 (미스터리 박스 + 힌트 퀴즈 + 워드클라우드)
 * 5. 리액션 폭발 테스트
 * 6. 실시간 리스너 지연 측정
 * 7. 정리
 *
 * 사용법: node tests/load-test-300.mjs [--keep]
 *   --keep: 테스트 후 세션 유지 (브라우저에서 확인용)
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
const USER_COUNT = 300;
const BATCH_SIZE = 15;
const SESSION_ID = 'lt300_' + Math.random().toString(36).slice(2, 8);
const KEEP_SESSION = process.argv.includes('--keep');
const REACTION_TYPES = ['thumbsUp', 'fire', 'heart', 'laugh', 'clap'];
const TEXT_ANSWERS = [
  '수박', '사과', '바나나', '딸기', '포도', '키위', '망고', '파인애플',
  '복숭아', '체리', '자두', '감', '배', '귤', '레몬', '라임',
  '블루베리', '라즈베리', '코코넛', '아보카도', '오렌지', '멜론',
  '참외', '무화과', '석류', '용과', '패션프루트', '구아바', '리치', '두리안',
];
const WORD_ANSWERS = [
  '행복', '도전', '성장', '꿈', '열정', '사랑', '감사', '인내',
  '용기', '창의', '자유', '배움', '노력', '희망', '긍정', '변화',
];

// --- Questions (all types) ---
const questions = {};
let order = 0;
function addQ(q) { const id = `ltq_${++order}`; questions[id] = { ...q, order }; return id; }

const qChoice = addQ({
  title: '[객관식] 좋아하는 계절은?',
  type: 'choice',
  options: ['봄', '여름', '가을', '겨울'],
});
const qQuiz = addQ({
  title: '[퀴즈] 대한민국의 수도는?',
  type: 'quiz',
  options: ['서울', '부산', '대구', '인천'],
  correctAnswer: '서울',
  points: 100,
  speedWindowMs: 30000,
  maxSpeedBonus: 50,
});
const qOX = addQ({
  title: '[O/X] 지구는 태양 주위를 돈다',
  type: 'ox',
  correctAnswer: 'O',
});
const qWordcloud = addQ({
  title: '[워드클라우드] 올해 목표를 한 단어로?',
  type: 'wordcloud',
});
const qQnA = addQ({
  title: '[Q&A] 궁금한 점 질문해주세요',
  type: 'qna',
});
const qScale = addQ({
  title: '[감정 온도계] 오늘 기분은?',
  type: 'scale',
});
const qDebate = addQ({
  title: '[찬반 토론] AI가 사람을 대체할 수 있다',
  type: 'debate',
});
const qRanking = addQ({
  title: '[순위 맞추기] 큰 행성 순서',
  type: 'ranking',
  options: ['목성', '토성', '천왕성', '해왕성'],
  correctAnswer: '0,1,2,3',
});
const qFillblank = addQ({
  title: '[빈칸 채우기] HTTP 상태코드 ___는 Not Found',
  type: 'fillinblank',
  correctAnswer: '404',
});
const qCheck = addQ({
  title: '[실습 체크] 실습 완료 체크',
  type: 'check',
});
const qMystery = addQ({
  title: '[미스터리 박스] 이 과일은 무엇일까요?',
  type: 'mysteryBox',
  correctAnswer: '수박',
  mysteryItems: ['사과', '바나나', '딸기', '포도'],
});
const qHintQuiz = addQ({
  title: '[힌트 퀴즈] 이 나라는 어디일까요?',
  type: 'hintQuiz',
  correctAnswer: '대한민국',
  hints: ['아시아에 있습니다', '반도 국가입니다', '김치가 유명합니다', 'K-pop의 나라입니다'],
  revealedHints: 0,
});

// --- State ---
const apps = [];
const dbs = [];
const results = {
  joinLatencies: [],
  voteLatencies: {},
  textBubbleLatencies: [],
  reactionLatencies: [],
  chatLatencies: [],
  listenerLatencies: [],
  errors: [],
};

function log(msg) { process.stdout.write(`[${new Date().toLocaleTimeString()}] ${msg}\n`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function avg(arr) { return arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(0) : '0'; }
function max(arr) { return arr.length ? Math.max(...arr).toFixed(0) : '0'; }
function p95(arr) {
  if (!arr.length) return '0';
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.95)].toFixed(0);
}

// --- Phase 1: Create connections ---
async function createConnections() {
  log(`📡 Firebase 앱 ${USER_COUNT}개 생성 중...`);
  for (let i = 0; i < USER_COUNT; i++) {
    const app = initializeApp(firebaseConfig, `lt300_${i}`);
    apps.push(app);
    dbs.push(getDatabase(app));
  }
  log(`✅ ${USER_COUNT}개 앱 생성 완료`);
}

// --- Phase 2: Create session + Join ---
async function createSessionAndJoin() {
  log(`\n📝 테스트 세션 생성: ${SESSION_ID}`);
  log(`   질문 ${Object.keys(questions).length}개 (모든 유형)`);

  await set(ref(dbs[0], `sessions/${SESSION_ID}`), {
    courseName: '300명 부하 테스트',
    roundNumber: 1,
    status: 'active',
    currentMode: 'waiting',
    currentQuestion: null,
    createdAt: Date.now(),
    requireEmployeeId: true, // 이벤트 모드 — 참여자마다 사번 포함
    questions,
  });

  log(`\n🚪 ${USER_COUNT}명 입장 시작 (${BATCH_SIZE}명씩)...`);
  let joined = 0;

  for (let batch = 0; batch < USER_COUNT; batch += BATCH_SIZE) {
    const batchEnd = Math.min(batch + BATCH_SIZE, USER_COUNT);
    const promises = [];

    for (let i = batch; i < batchEnd; i++) {
      const pid = `lt_u${String(i).padStart(4, '0')}`;
      const start = performance.now();
      const p = set(ref(dbs[i], `sessions/${SESSION_ID}/participants/${pid}`), {
        nickname: `학생${i + 1}`,
        joinedAt: Date.now(),
        online: true,
        employeeId: `2026${String(i + 1).padStart(4, '0')}`, // 이벤트 모드 사번
      }).then(() => {
        results.joinLatencies.push(performance.now() - start);
        joined++;
      }).catch(err => results.errors.push({ phase: 'join', user: i, error: err.message }));
      promises.push(p);
    }

    await Promise.all(promises);
    if (joined % 60 === 0 || joined === USER_COUNT) {
      log(`  입장: ${joined}/${USER_COUNT}`);
    }
  }

  log(`✅ 전원 입장 — 평균 ${avg(results.joinLatencies)}ms, P95 ${p95(results.joinLatencies)}ms, 최대 ${max(results.joinLatencies)}ms`);
}

// --- Phase 3: Vote on each question type ---
async function voteOnQuestion(questionId, questionType, generateVote) {
  const label = `${questionType}`;
  results.voteLatencies[label] = [];
  log(`  🗳️ ${label}: ${USER_COUNT}명 투표 중...`);

  // Activate question
  await update(ref(dbs[0], `sessions/${SESSION_ID}`), {
    currentQuestion: questionId,
    currentMode: questionType === 'quiz' ? 'quiz' : 'poll',
  });
  await sleep(300);

  const promises = [];
  for (let i = 0; i < USER_COUNT; i++) {
    const pid = `lt_u${String(i).padStart(4, '0')}`;
    const delay = Math.random() * 2000;
    const start = performance.now();

    const p = sleep(delay).then(() =>
      set(ref(dbs[i], `sessions/${SESSION_ID}/questions/${questionId}/votes/${pid}`), {
        value: generateVote(i),
        timestamp: Date.now(),
        nickname: `학생${i + 1}`,
      })
    ).then(() => {
      results.voteLatencies[label].push(performance.now() - start - delay);
    }).catch(err => results.errors.push({ phase: `vote-${label}`, user: i, error: err.message }));

    promises.push(p);
  }

  await Promise.all(promises);
  const lats = results.voteLatencies[label];
  log(`    ✅ ${lats.length}/${USER_COUNT} 성공 — 평균 ${avg(lats)}ms, P95 ${p95(lats)}ms`);
}

async function testAllQuestionTypes() {
  log(`\n📊 전체 질문 유형 투표 테스트 시작...\n`);

  // Choice
  await voteOnQuestion(qChoice, 'choice', (i) => ['봄', '여름', '가을', '겨울'][i % 4]);
  // Quiz
  await voteOnQuestion(qQuiz, 'quiz', (i) => ['서울', '부산', '대구', '인천'][i % 4]);
  // OX
  await voteOnQuestion(qOX, 'ox', (i) => i % 3 === 0 ? 'X' : 'O');
  // Wordcloud — text bubble test!
  await voteOnQuestion(qWordcloud, 'wordcloud', (i) => WORD_ANSWERS[i % WORD_ANSWERS.length]);
  // Scale
  await voteOnQuestion(qScale, 'scale', (i) => String(1 + (i % 5)));
  // Debate
  await voteOnQuestion(qDebate, 'debate', (i) => i % 2 === 0 ? 'agree' : 'disagree');
  // Ranking
  await voteOnQuestion(qRanking, 'ranking', (i) => {
    const arr = [0, 1, 2, 3];
    for (let j = arr.length - 1; j > 0; j--) {
      const k = (i + j) % (j + 1);
      [arr[j], arr[k]] = [arr[k], arr[j]];
    }
    return arr.join(',');
  });
  // Fill in blank — text bubble test!
  await voteOnQuestion(qFillblank, 'fillinblank', (i) => i % 5 === 0 ? '404' : ['200', '500', '403', '301'][i % 4]);
  // Check
  await voteOnQuestion(qCheck, 'check', () => 'done');
  // Mystery Box — TEXT BUBBLE PRIMARY TEST
  await voteOnQuestion(qMystery, 'mysteryBox', (i) => TEXT_ANSWERS[i % TEXT_ANSWERS.length]);
  // Hint Quiz — TEXT BUBBLE TEST
  await voteOnQuestion(qHintQuiz, 'hintQuiz', (i) => {
    const guesses = ['대한민국', '일본', '중국', '태국', '한국', '대한민국', '베트남', '필리핀'];
    return guesses[i % guesses.length];
  });
}

// --- Phase 4: Text bubble burst test (1 minute endurance) ---
async function textBubbleBurstTest() {
  log(`\n💬 텍스트 버블 폭발 테스트 — 1분간 연속 입력 시뮬레이션...`);

  // Use a fresh question for burst test
  const burstQId = 'ltq_burst';
  await set(ref(dbs[0], `sessions/${SESSION_ID}/questions/${burstQId}`), {
    title: '[버블 부하] 자유 입력',
    type: 'mysteryBox',
    correctAnswer: '테스트',
    order: order + 1,
  });
  await update(ref(dbs[0], `sessions/${SESSION_ID}`), {
    currentQuestion: burstQId,
    currentMode: 'poll',
  });
  await sleep(500);

  const startTime = Date.now();
  const DURATION_MS = 30000; // 30초 (Firebase 요금 절약)
  let totalWrites = 0;
  let round = 0;

  while (Date.now() - startTime < DURATION_MS) {
    round++;
    // 50명씩 동시 입력 (실제 300명이 동시에 치진 않으므로)
    const batchUsers = Math.min(50, USER_COUNT);
    const promises = [];

    for (let i = 0; i < batchUsers; i++) {
      const userIdx = (round * 50 + i) % USER_COUNT;
      // 실제 참여자 pid 사용(재투표는 같은 키 덮어쓰기 — 현실적). votes 규칙이 participant
      // 존재를 요구하므로 합성 _r{round} 키는 거부됨(보안 규칙 정상 동작).
      const pid = `lt_u${String(userIdx).padStart(4, '0')}`;
      const text = TEXT_ANSWERS[Math.floor(Math.random() * TEXT_ANSWERS.length)];
      const start = performance.now();

      const p = set(ref(dbs[userIdx], `sessions/${SESSION_ID}/questions/${burstQId}/votes/${pid}`), {
        value: text,
        timestamp: Date.now(),
        nickname: `학생${userIdx + 1}`,
      }).then(() => {
        results.textBubbleLatencies.push(performance.now() - start);
        totalWrites++;
      }).catch(err => results.errors.push({ phase: 'bubble-burst', user: userIdx, error: err.message }));

      promises.push(p);
    }

    await Promise.all(promises);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    log(`  라운드 ${round}: ${totalWrites}건 (${elapsed}초 경과) — 평균 ${avg(results.textBubbleLatencies.slice(-50))}ms`);
    await sleep(500); // 0.5초 간격 배치
  }

  log(`✅ 버블 폭발 테스트 완료 — ${totalWrites}건, 평균 ${avg(results.textBubbleLatencies)}ms, P95 ${p95(results.textBubbleLatencies)}ms`);
}

// --- Phase 5: Reaction burst ---
async function reactionBurstTest() {
  log(`\n🎉 리액션 폭발 테스트 (${USER_COUNT}명 × 2회)...`);

  for (let round = 0; round < 2; round++) {
    const promises = [];
    for (let i = 0; i < USER_COUNT; i++) {
      const type = REACTION_TYPES[Math.floor(Math.random() * REACTION_TYPES.length)];
      const start = performance.now();

      const p = push(ref(dbs[i], `sessions/${SESSION_ID}/reactions`), {
        type,
        timestamp: Date.now(),
      }).then(() => {
        results.reactionLatencies.push(performance.now() - start);
      }).catch(err => results.errors.push({ phase: 'reaction', user: i, error: err.message }));

      promises.push(p);
    }
    await Promise.all(promises);
    log(`  라운드 ${round + 1}/2 — 평균 ${avg(results.reactionLatencies.slice(-USER_COUNT))}ms`);
    await sleep(500);
  }

  log(`✅ 리액션 완료 — ${results.reactionLatencies.length}건, 평균 ${avg(results.reactionLatencies)}ms`);
}

// --- Phase 5b: Chat burst (공개 채팅 — 300명 동시 채팅) ---
const CHAT_MSGS = ['안녕하세요!', 'ㅋㅋㅋ', '오 신기하다', '질문 있어요', '재밌어요', '동의합니다', '잘 보고있어요', '대박', '굿굿', '+1'];
async function chatBurstTest() {
  log(`\n💬 채팅 폭발 테스트 (${USER_COUNT}명 × 2회)...`);
  for (let round = 0; round < 2; round++) {
    const promises = [];
    for (let i = 0; i < USER_COUNT; i++) {
      const text = CHAT_MSGS[Math.floor(Math.random() * CHAT_MSGS.length)];
      const start = performance.now();
      const p = push(ref(dbs[i], `sessions/${SESSION_ID}/chat`), {
        text,
        sender: `학생${i + 1}`.slice(0, 20),
        senderType: 'student',
        timestamp: Date.now(),
      }).then(() => {
        results.chatLatencies.push(performance.now() - start);
      }).catch(err => results.errors.push({ phase: 'chat', user: i, error: err.message }));
      promises.push(p);
    }
    await Promise.all(promises);
    log(`  라운드 ${round + 1}/2 — 평균 ${avg(results.chatLatencies.slice(-USER_COUNT))}ms`);
    await sleep(500);
  }
  log(`✅ 채팅 완료 — ${results.chatLatencies.length}건, 평균 ${avg(results.chatLatencies)}ms`);
}

// --- Phase 6: Listener latency ---
async function testListenerLatency() {
  log(`\n📡 실시간 리스너 지연 측정 (50명 샘플)...`);

  return new Promise((resolve) => {
    let received = 0;
    const sampleSize = 50;
    const unsubs = [];
    const writeTime = performance.now();

    for (let i = 0; i < sampleSize; i++) {
      const unsub = onValue(ref(dbs[i], `sessions/${SESSION_ID}/currentMode`), (snap) => {
        if (snap.val() === 'leaderboard') {
          results.listenerLatencies.push(performance.now() - writeTime);
          received++;
          if (received >= sampleSize) {
            unsubs.forEach(u => u());
            resolve();
          }
        }
      });
      unsubs.push(unsub);
    }

    setTimeout(async () => {
      await update(ref(dbs[0], `sessions/${SESSION_ID}`), { currentMode: 'leaderboard' });
    }, 1000);

    setTimeout(() => {
      log(`  ⚠️ ${received}/${sampleSize} 수신`);
      unsubs.forEach(u => u());
      resolve();
    }, 10000);
  });
}

// --- Cleanup ---
async function cleanup() {
  if (KEEP_SESSION) {
    log(`\n📌 --keep 플래그: 세션 유지 (${SESSION_ID})`);
    log(`   학생: http://localhost:5180/?s=${SESSION_ID}`);
    log(`   강사: http://localhost:5180/admin?s=${SESSION_ID}`);
    log(`   라이브: http://localhost:5180/live?s=${SESSION_ID}`);
  } else {
    log(`\n🧹 테스트 데이터 정리 중...`);
    try {
      await remove(ref(dbs[0], `sessions/${SESSION_ID}`));
      log(`✅ 세션 삭제 완료`);
    } catch (err) {
      log(`⚠️ 정리 실패: ${err.message}`);
    }
  }

  log(`📡 ${USER_COUNT}개 Firebase 연결 종료 중...`);
  for (const app of apps) {
    try { await deleteApp(app); } catch { /* ignore */ }
  }
  log(`✅ 연결 종료 완료`);
}

// --- Report ---
function printReport() {
  log(`\n${'═'.repeat(65)}`);
  log(`📊 부하 테스트 결과 — ${USER_COUNT}명 동시접속`);
  log(`${'═'.repeat(65)}`);

  log(`\n[입장] ${results.joinLatencies.length}/${USER_COUNT}`);
  log(`  평균: ${avg(results.joinLatencies)}ms | P95: ${p95(results.joinLatencies)}ms | 최대: ${max(results.joinLatencies)}ms`);

  log(`\n[질문 유형별 투표]`);
  for (const [type, lats] of Object.entries(results.voteLatencies)) {
    log(`  ${type.padEnd(12)} ${lats.length}/${USER_COUNT} — 평균 ${avg(lats)}ms | P95 ${p95(lats)}ms`);
  }

  log(`\n[텍스트 버블 폭발] ${results.textBubbleLatencies.length}건`);
  log(`  평균: ${avg(results.textBubbleLatencies)}ms | P95: ${p95(results.textBubbleLatencies)}ms | 최대: ${max(results.textBubbleLatencies)}ms`);

  log(`\n[리액션] ${results.reactionLatencies.length}건`);
  log(`  평균: ${avg(results.reactionLatencies)}ms | P95: ${p95(results.reactionLatencies)}ms`);

  log(`\n[채팅] ${results.chatLatencies.length}건`);
  log(`  평균: ${avg(results.chatLatencies)}ms | P95: ${p95(results.chatLatencies)}ms`);

  log(`\n[리스너 지연] ${results.listenerLatencies.length}개`);
  log(`  평균: ${avg(results.listenerLatencies)}ms | P95: ${p95(results.listenerLatencies)}ms`);

  log(`\n[에러] ${results.errors.length}건`);
  if (results.errors.length > 0) {
    const byPhase = {};
    results.errors.forEach(e => { byPhase[e.phase] = (byPhase[e.phase] || 0) + 1; });
    Object.entries(byPhase).forEach(([phase, count]) => log(`  ${phase}: ${count}건`));
  }

  log(`\n${'─'.repeat(65)}`);
  log(`판정:`);

  const joinOk = results.joinLatencies.length >= USER_COUNT * 0.95;
  const allVoteOk = Object.values(results.voteLatencies).every(lats => lats.length >= USER_COUNT * 0.95);
  const bubbleOk = results.textBubbleLatencies.length > 0 && parseFloat(p95(results.textBubbleLatencies)) < 5000;
  const listenerOk = results.listenerLatencies.length > 0 && parseFloat(avg(results.listenerLatencies)) < 3000;
  const errorRate = results.errors.length / (USER_COUNT * 15) * 100; // approximate total ops
  const errorOk = errorRate < 5;

  log(`  입장 ≥95%:       ${joinOk ? '✅ PASS' : '❌ FAIL'} (${(results.joinLatencies.length / USER_COUNT * 100).toFixed(1)}%)`);
  log(`  전유형 투표 ≥95%: ${allVoteOk ? '✅ PASS' : '❌ FAIL'}`);
  log(`  버블 P95 <5초:    ${bubbleOk ? '✅ PASS' : '❌ FAIL'} (${p95(results.textBubbleLatencies)}ms)`);
  log(`  리스너 평균 <3초:  ${listenerOk ? '✅ PASS' : '❌ FAIL'} (${avg(results.listenerLatencies)}ms)`);
  log(`  에러율 <5%:       ${errorOk ? '✅ PASS' : '❌ FAIL'} (${errorRate.toFixed(1)}%)`);

  const allPass = joinOk && allVoteOk && bubbleOk && listenerOk && errorOk;
  log(`\n  ${allPass ? '🎉 ALL PASS — 300명 동시접속 준비 완료!' : '⚠️ 일부 실패 — 위 결과를 검토하세요'}`);
  log(`${'═'.repeat(65)}\n`);
}

// --- Main ---
async function main() {
  log(`🚀 DoranDoran 300명 부하 테스트 시작\n`);

  try {
    await createConnections();
    await createSessionAndJoin();
    await sleep(2000);
    await testListenerLatency();
    await sleep(1000);
    await testAllQuestionTypes();
    await sleep(1000);
    await textBubbleBurstTest();
    await sleep(1000);
    await reactionBurstTest();
    await sleep(1000);
    await chatBurstTest();
    printReport();
  } catch (err) {
    log(`\n❌ 테스트 실패: ${err.message}`);
    console.error(err);
  } finally {
    await cleanup();
  }
}

main();
