if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000') throw new Error('부하/정리 도구는 로컬 demo 에뮬레이터에서만 실행하세요.');
/**
 * 실제 사용 느낌 시나리오 — 300명이 자연스럽게 사용(순간 폭주 X, 시간 분산 O).
 *  - 입장: ~25초에 걸쳐 파도치듯 분산
 *  - 문항 5개(주관식/객관식 혼합): 각 ~28초 열림, 참여자 80%가 창 안 랜덤 시점에 답변
 *  - 채팅/리액션: 세션 내내 산발적으로 지속(사람들이 반응하듯)
 *  - 실시간 write 성공률/지연/초당 처리량 측정 → 렉·오류 판단
 *  - sid=<id> 고정 / --keep 유지(관전) / 기본은 완전 정리
 *
 * 실행: node tests/scenario-realistic-300.mjs sid=scn_real --keep
 */
import { initializeApp, deleteApp } from 'firebase/app';
import { getDatabase, ref, set, push, update, remove, get, serverTimestamp } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCsRs1BTT1NphOpbkoAwKn7rnrdQk16R2I",
  authDomain: "jinan-6c884.firebaseapp.com",
  databaseURL: "http://127.0.0.1:9000/?ns=demo-dorandoran",
  projectId: "demo-dorandoran",
  storageBucket: "jinan-6c884.firebasestorage.app",
  messagingSenderId: "956378670080",
  appId: "1:956378670080:web:2147d0766564dd00dde4e5",
};

const USER_COUNT = 300;
const SID_ARG = (process.argv.find((a) => a.startsWith('sid=')) || '').slice(4);
const SESSION_ID = SID_ARG || ('scn_real_' + Math.random().toString(36).slice(2, 7));
const KEEP = process.argv.includes('--keep');
const BASE = 'https://jinan-6c884.web.app';

const JOIN_WINDOW_MS = 25000;
const Q_WINDOW_MS = 28000;
const PARTICIPATION = 0.82;

const SUBJ_ONLY = process.argv.includes('--subjective');
const QUESTIONS = SUBJ_ONLY ? {
  q1: { title: '오늘 세션에서 가장 인상 깊었던 점은?', type: 'subjective', order: 0 },
  q2: { title: '가장 유익했던 실습/활동은 무엇이었나요?', type: 'subjective', order: 1 },
  q3: { title: '현업에 어떻게 적용하고 싶으신가요?', type: 'subjective', order: 2 },
  q4: { title: '강사님께 한마디 남겨주세요', type: 'subjective', order: 3 },
  q5: { title: '다음에 다루면 좋을 주제를 자유롭게 적어주세요', type: 'subjective', order: 4 },
} : {
  q1: { title: '오늘 세션에서 가장 인상 깊었던 점은?', type: 'subjective', order: 0 },
  q2: { title: '난이도는 어땠나요?', type: 'choice', options: ['너무 쉬움', '적당함', '조금 어려움', '많이 어려움'], order: 1 },
  q3: { title: '현업에 어떻게 적용하고 싶으신가요?', type: 'subjective', order: 2 },
  q4: { title: '이번 워크샵 만족도는?', type: 'scale', order: 3 },
  q5: { title: '다음에 다루면 좋을 주제를 자유롭게 적어주세요', type: 'subjective', order: 4 },
};
const Q_ORDER = ['q1', 'q2', 'q3', 'q4', 'q5'];

const SUBJ = ['실습이 정말 유익했어요', '협업 파트가 인상 깊었습니다', '발표 자료가 깔끔했어요', '피드백이 구체적이라 좋았습니다', '현업에 바로 적용하고 싶어요', '강사님 설명이 이해가 잘 됐어요', '네트워킹이 즐거웠어요', '다음에도 참여하고 싶어요', '속도가 딱 적당했어요', '질의응답이 도움 됐어요', '팀 프로젝트가 재밌었어요', '실무 예시가 많아 좋았어요'];
const CHOICE_Q2 = ['너무 쉬움', '적당함', '조금 어려움', '많이 어려움'];
const CHATS = ['ㅋㅋㅋ', '오 신기하다', '동의합니다', '재밌어요', '질문 있어요!', '대박', '굿굿', '+1', '맞아요', '집중!', '좋네요', '공감합니다'];
const REACTIONS = ['like', 'fire', 'heart', 'laugh', 'clap'];

const apps = [], dbs = [];
const R = { join: [], answer: [], chat: [], reaction: [], errors: [], writeTimes: [] };
const log = (m) => console.log(`[${new Date().toLocaleTimeString()}] ${m}`);
const avg = (a) => a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : 0;
const p95 = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.floor(s.length * 0.95)]); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (n) => Math.floor(seededRandom() * n);
// 결정론적 의사난수(스크립트 재현성 — Math.random 미사용 제약 회피 불필요하지만 일관성용)
let _seed = 987654321;
function seededRandom() { _seed = (_seed * 1103515245 + 12345) & 0x7fffffff; return _seed / 0x7fffffff; }
const pid = (i) => `sr_u${String(i).padStart(4, '0')}`;

function track(promise, bucket, phase, i) {
  const t = performance.now();
  return promise.then(() => { const d = performance.now() - t; R[bucket].push(d); R.writeTimes.push(Date.now()); })
    .catch((e) => R.errors.push({ phase, i, e: e.message }));
}

async function setup() {
  log(`🔌 ${USER_COUNT}개 연결 생성...`);
  for (let i = 0; i < USER_COUNT; i++) { const a = initializeApp(firebaseConfig, `sr_${i}`); apps.push(a); dbs.push(getDatabase(a)); }
  await set(ref(dbs[0], `sessions/${SESSION_ID}`), {
    courseName: '실사용 부하 시나리오', roundNumber: 1, status: 'active',
    currentMode: 'waiting', currentQuestion: null, createdAt: Date.now(), requireEmployeeId: true, questions: QUESTIONS,
  });
  log(`✅ 방 생성: ${SESSION_ID}`);
  console.log('\n' + '━'.repeat(64));
  console.log('  🖥️  전자칠판:  ' + `${BASE}/live?s=${SESSION_ID}`);
  console.log('━'.repeat(64) + '\n');
}

// 입장을 25초에 걸쳐 파도치듯 분산
async function joinStaggered() {
  log(`🚪 300명 입장 — ${JOIN_WINDOW_MS / 1000}초에 걸쳐 분산...`);
  const promises = [];
  for (let i = 0; i < USER_COUNT; i++) {
    const delay = Math.floor((i / USER_COUNT) * JOIN_WINDOW_MS + seededRandom() * 1500);
    promises.push(sleep(delay).then(() => track(
      set(ref(dbs[i], `sessions/${SESSION_ID}/participants/${pid(i)}`), {
        nickname: `참여자${i + 1}`, joinedAt: Date.now(), online: true, employeeId: `2026${String(i + 1).padStart(4, '0')}`,
      }), 'join', 'join', i)));
  }
  await Promise.all(promises);
  const snap = await get(ref(dbs[0], `sessions/${SESSION_ID}/participants`));
  log(`✅ 입장 ${R.join.length}/${USER_COUNT} (등록 ${Object.keys(snap.val() || {}).length}명) — 평균 ${avg(R.join)}ms`);
}

let bgRunning = false;
// 세션 내내 채팅/리액션 산발적으로(사람들이 반응하듯)
function startBackgroundChatter() {
  bgRunning = true;
  const chatLoop = async () => {
    while (bgRunning) {
      const i = rand(USER_COUNT);
      track(push(ref(dbs[i], `sessions/${SESSION_ID}/chat`), { text: CHATS[rand(CHATS.length)], sender: `참여자${i + 1}`, senderType: 'student', timestamp: serverTimestamp() }), 'chat', 'chat', i);
      await sleep(500 + seededRandom() * 900); // 초당 ~1.4건
    }
  };
  const reactLoop = async () => {
    while (bgRunning) {
      const burst = 1 + rand(4); // 가끔 몰림
      for (let k = 0; k < burst; k++) { const i = rand(USER_COUNT); track(push(ref(dbs[i], `sessions/${SESSION_ID}/reactions`), { type: REACTIONS[rand(REACTIONS.length)], timestamp: Date.now() }), 'reaction', 'reaction', i); }
      await sleep(280 + seededRandom() * 500); // 초당 ~5건
    }
  };
  chatLoop(); reactLoop();
}

// 한 문항: 활성화 후 창 안에서 참여자 82%가 랜덤 시점에 답변(트리클)
async function runQuestion(qid, idx) {
  const q = QUESTIONS[qid];
  await update(ref(dbs[0], `sessions/${SESSION_ID}`), { currentQuestion: qid, currentMode: q.type === 'quiz' ? 'quiz' : 'poll', [`questions/${qid}/activatedAt`]: Date.now() });
  log(`  ▶ 문항 ${idx + 1}/5 (${q.type}) 활성화 — ${Q_WINDOW_MS / 1000}초 창, ~82% 트리클 답변`);
  const answerPromises = [];
  for (let i = 0; i < USER_COUNT; i++) {
    if (seededRandom() > PARTICIPATION) continue; // 일부는 미응답
    const when = Math.floor(seededRandom() * (Q_WINDOW_MS - 3000)) + 1000;
    let value;
    if (q.type === 'choice') value = CHOICE_Q2[rand(CHOICE_Q2.length)];
    else if (q.type === 'scale') value = String(40 + rand(61)); // 40~100
    else value = SUBJ[rand(SUBJ.length)];
    answerPromises.push(sleep(when).then(() => track(
      set(ref(dbs[i], `sessions/${SESSION_ID}/questions/${qid}/votes/${pid(i)}`), { value, nickname: `참여자${i + 1}`, timestamp: Date.now() }), 'answer', 'answer', i)));
  }
  await sleep(Q_WINDOW_MS); // 창 유지
  await Promise.all(answerPromises); // 잔여 답변 완료 대기
}

async function cleanup() {
  bgRunning = false;
  await sleep(300);
  if (KEEP) {
    log(`\n🔒 --keep: 세션 유지(${SESSION_ID}). 관전 후 수동 삭제.`);
    for (const a of apps) { try { await deleteApp(a); } catch { /* */ } }
    return;
  }
  log(`\n🧹 완전 원상복구...`);
  try { await remove(ref(dbs[0], `sessions/${SESSION_ID}`)); const c = await get(ref(dbs[0], `sessions/${SESSION_ID}`)); log(`  세션 삭제: ${c.exists() ? '❌' : '✅ 완전 삭제'}`); } catch (e) { log(`  삭제 오류: ${e.message}`); }
  for (const a of apps) { try { await deleteApp(a); } catch { /* */ } }
}

function report() {
  const total = R.answer.length + R.chat.length + R.reaction.length;
  const errRate = total ? (R.errors.length / (total + R.errors.length) * 100) : 0;
  // 초당 처리량 피크 계산
  const buckets = {};
  for (const t of R.writeTimes) { const s = Math.floor(t / 1000); buckets[s] = (buckets[s] || 0) + 1; }
  const rates = Object.values(buckets);
  const peakRate = rates.length ? Math.max(...rates) : 0;
  const avgRate = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0;
  console.log('\n' + '─'.repeat(64));
  log('📊 실사용 시나리오 결과');
  log(`  입장: ${R.join.length}/${USER_COUNT} — 평균 ${avg(R.join)}ms P95 ${p95(R.join)}ms`);
  log(`  답변: ${R.answer.length}건 — 평균 ${avg(R.answer)}ms P95 ${p95(R.answer)}ms`);
  log(`  채팅: ${R.chat.length}건 — 평균 ${avg(R.chat)}ms P95 ${p95(R.chat)}ms`);
  log(`  리액션: ${R.reaction.length}건 — 평균 ${avg(R.reaction)}ms P95 ${p95(R.reaction)}ms`);
  log(`  처리량: 평균 ${avgRate}건/초, 피크 ${peakRate}건/초`);
  log(`  에러: ${R.errors.length}건 (${errRate.toFixed(2)}%)`);
  console.log('─'.repeat(64));
  const pass = R.join.length >= USER_COUNT * 0.95 && errRate < 1;
  log(pass ? '  🎉 렉·오류 없음 — 실사용 안정' : '  ⚠️ 검토 필요');
  if (R.errors.length) console.log('첫 에러:', R.errors.slice(0, 3));
}

async function main() {
  console.log('═'.repeat(64));
  log('실제 사용 느낌 시나리오 — 300명 자연 분산(입장/트리클 답변/산발 채팅·리액션)');
  console.log('═'.repeat(64));
  try {
    await setup();
    await joinStaggered();
    startBackgroundChatter();
    log(`\n💬 문항 진행 (배경 채팅·리액션 지속)...`);
    for (let q = 0; q < Q_ORDER.length; q++) { await runQuestion(Q_ORDER[q], q); await sleep(1500); }
    if (KEEP) await update(ref(dbs[0], `sessions/${SESSION_ID}`), { currentQuestion: 'q1', currentMode: 'poll' }).catch(() => {});
  } catch (e) { log(`❌ ${e.message}`); R.errors.push({ phase: 'fatal', e: e.message }); }
  finally { await cleanup(); }
  report();
  process.exit(0);
}
main();
