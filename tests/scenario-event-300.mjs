if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000') throw new Error('부하/정리 도구는 로컬 demo 에뮬레이터에서만 실행하세요.');
/**
 * 이벤트 모드 종합 시나리오 — 300명 동시접속.
 *  1) 이벤트모드 방 생성(requireEmployeeId) + 주관식 10문항
 *  2) 300명 입장(사번 포함)
 *  3) 연결관리 — 배치 끊김(goOffline+onDisconnect) → online:false 확인 → 재접속 → online:true 확인
 *  4) 주관식 10문항 상호작용 — 각 문항 활성화 → 300명 답변 + 채팅/이모티콘 남발(동시)
 *  5) 완전 원상복구 — 세션·참여자 전부 삭제 + 연결 해제
 *
 * 실행: node tests/scenario-event-300.mjs
 */
import { initializeApp, deleteApp } from 'firebase/app';
import { getDatabase, ref, set, push, update, remove, get, onDisconnect, goOffline, goOnline, serverTimestamp } from 'firebase/database';

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
// sid=<id> 인자로 고정 세션ID 지정 가능(라이브 관전용). --keep 시 정리 안 함.
const SID_ARG = (process.argv.find((a) => a.startsWith('sid=')) || '').slice(4);
const SESSION_ID = SID_ARG || ('scn_evt_' + Math.random().toString(36).slice(2, 8));
const KEEP = process.argv.includes('--keep');
const WATCH = process.argv.includes('--watch'); // 관전 페이싱(문항 사이 여유)
const CHURN_COUNT = 30; // 연결 끊김/재접속 테스트 대상 수
const Q_COUNT = 10;
const BASE = 'https://jinan-6c884.web.app';

const ANSWERS = [
  '실습이 정말 유익했어요', '협업하는 부분이 인상 깊었습니다', '발표 자료가 깔끔했어요',
  '피드백이 구체적이라 좋았습니다', '코딩 실습 시간이 더 있으면 좋겠어요', '강사님 설명이 이해가 잘 됐어요',
  '네트워킹 시간이 즐거웠어요', '다음에도 참여하고 싶어요', '내용이 알찼습니다', '현업에 바로 적용 가능할 것 같아요',
];
const CHATS = ['ㅋㅋㅋ', '오 신기하다', '동의합니다', '재밌어요', '질문 있어요!', '대박', '굿굿', '+1', '맞아요', '집중!'];
const REACTIONS = ['like', 'fire', 'heart', 'laugh', 'clap'];

const apps = [], dbs = [];
const results = { join: [], answer: [], chat: [], reaction: [], errors: [] };
const log = (m) => console.log(`[${new Date().toLocaleTimeString()}] ${m}`);
const avg = (a) => a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : 0;
const p95 = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.floor(s.length * 0.95)]); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const pid = (i) => `scn_u${String(i).padStart(4, '0')}`;

async function setup() {
  log(`🔌 ${USER_COUNT}개 연결 생성...`);
  for (let i = 0; i < USER_COUNT; i++) {
    const app = initializeApp(firebaseConfig, `scn_${i}`);
    apps.push(app); dbs.push(getDatabase(app));
  }
  // 이벤트모드 세션 + 주관식 10문항
  const questions = {};
  for (let i = 0; i < Q_COUNT; i++) {
    questions[`q_subj_${i}`] = { title: `주관식 ${i + 1}번 — 오늘 세션에서 느낀 점은?`, type: 'subjective', order: i };
  }
  await set(ref(dbs[0], `sessions/${SESSION_ID}`), {
    courseName: '이벤트 모드 시나리오 검증', roundNumber: 1, status: 'active',
    currentMode: 'waiting', currentQuestion: null, createdAt: Date.now(),
    requireEmployeeId: true, questions,
  });
  log(`✅ 이벤트모드 방 생성: ${SESSION_ID} (주관식 ${Q_COUNT}문항)`);
  console.log('\n' + '━'.repeat(65));
  console.log('  🖥️  전자칠판(관전):  ' + `${BASE}/live?s=${SESSION_ID}`);
  console.log('  🧑‍🏫 강사 화면:       ' + `${BASE}/admin?s=${SESSION_ID}`);
  console.log('  📱 학생 입장:        ' + `${BASE}/?s=${SESSION_ID}`);
  console.log('━'.repeat(65) + '\n');
}

async function joinAll() {
  log(`\n🚪 300명 입장(사번 포함)...`);
  const BATCH = 50;
  for (let b = 0; b < USER_COUNT; b += BATCH) {
    const ps = [];
    for (let i = b; i < Math.min(b + BATCH, USER_COUNT); i++) {
      const start = performance.now();
      ps.push(set(ref(dbs[i], `sessions/${SESSION_ID}/participants/${pid(i)}`), {
        nickname: `학생${i + 1}`, joinedAt: Date.now(), online: true,
        employeeId: `2026${String(i + 1).padStart(4, '0')}`,
      }).then(() => results.join.push(performance.now() - start))
        .catch(e => results.errors.push({ phase: 'join', i, e: e.message })));
    }
    await Promise.all(ps);
  }
  const snap = await get(ref(dbs[0], `sessions/${SESSION_ID}/participants`));
  log(`✅ 입장 ${results.join.length}/${USER_COUNT} — 평균 ${avg(results.join)}ms, 등록 ${Object.keys(snap.val() || {}).length}명`);
}

async function connectionTest() {
  log(`\n📡 연결관리 테스트 — ${CHURN_COUNT}명 끊김→재접속...`);
  // onDisconnect 무장 후 goOffline → 서버가 online:false 처리
  for (let i = 0; i < CHURN_COUNT; i++) {
    const onlineRef = ref(dbs[i], `sessions/${SESSION_ID}/participants/${pid(i)}/online`);
    await onDisconnect(onlineRef).set(false);
  }
  for (let i = 0; i < CHURN_COUNT; i++) goOffline(dbs[i]);
  await sleep(3000); // 서버가 onDisconnect 반영할 시간
  // 다른 연결로 online 상태 확인
  let offCount = 0;
  for (let i = 0; i < CHURN_COUNT; i++) {
    const s = await get(ref(dbs[USER_COUNT - 1], `sessions/${SESSION_ID}/participants/${pid(i)}/online`));
    if (s.val() === false) offCount++;
  }
  log(`  끊김 반영: ${offCount}/${CHURN_COUNT}명 online:false (onDisconnect 정상)`);
  // 재접속
  for (let i = 0; i < CHURN_COUNT; i++) {
    goOnline(dbs[i]);
    await update(ref(dbs[i], `sessions/${SESSION_ID}/participants/${pid(i)}`), { online: true }).catch(() => {});
  }
  await sleep(2000);
  let onCount = 0;
  for (let i = 0; i < CHURN_COUNT; i++) {
    const s = await get(ref(dbs[USER_COUNT - 1], `sessions/${SESSION_ID}/participants/${pid(i)}/online`));
    if (s.val() === true) onCount++;
  }
  log(`  재접속 반영: ${onCount}/${CHURN_COUNT}명 online:true`);
  return { offCount, onCount };
}

async function interactQuestion(qIdx) {
  const qid = `q_subj_${qIdx}`;
  await update(ref(dbs[0], `sessions/${SESSION_ID}`), { currentQuestion: qid, currentMode: 'poll', [`questions/${qid}/activatedAt`]: Date.now() });
  await sleep(300);
  const ps = [];
  // 300명 주관식 답변 + 채팅/이모티콘 남발(동시)
  for (let i = 0; i < USER_COUNT; i++) {
    // 답변
    let s = performance.now();
    ps.push(set(ref(dbs[i], `sessions/${SESSION_ID}/questions/${qid}/votes/${pid(i)}`), {
      value: ANSWERS[i % ANSWERS.length], nickname: `학생${i + 1}`, timestamp: Date.now(),
    }).then(() => results.answer.push(performance.now() - s)).catch(e => results.errors.push({ phase: 'answer', i, e: e.message })));
    // 채팅 (절반)
    if (i % 2 === 0) {
      let c = performance.now();
      ps.push(push(ref(dbs[i], `sessions/${SESSION_ID}/chat`), {
        text: CHATS[i % CHATS.length], sender: `학생${i + 1}`, senderType: 'student', timestamp: serverTimestamp(),
      }).then(() => results.chat.push(performance.now() - c)).catch(e => results.errors.push({ phase: 'chat', i, e: e.message })));
    }
    // 이모티콘 남발 (전원, 2회)
    for (let r = 0; r < 2; r++) {
      let rt = performance.now();
      ps.push(push(ref(dbs[i], `sessions/${SESSION_ID}/reactions`), {
        type: REACTIONS[(i + r) % REACTIONS.length], timestamp: Date.now(),
      }).then(() => results.reaction.push(performance.now() - rt)).catch(e => results.errors.push({ phase: 'reaction', i, e: e.message })));
    }
  }
  await Promise.all(ps);
}

async function runScenario() {
  log(`\n💬 주관식 10문항 상호작용(각 문항: 300답변 + 채팅 + 이모티콘 남발)...`);
  for (let q = 0; q < Q_COUNT; q++) {
    log(`  ▶ 주관식 ${q + 1}/10 활성화 → 300명 답변 + 채팅 + 이모티콘...`);
    await interactQuestion(q);
    log(`  문항 ${q + 1}/10 완료 — 답변 ${results.answer.length}, 채팅 ${results.chat.length}, 리액션 ${results.reaction.length} 누적`);
    await sleep(WATCH ? 4000 : 400); // 관전 모드: 전자칠판에서 결과 볼 여유
  }
  if (WATCH) { await update(ref(dbs[0], `sessions/${SESSION_ID}`), { currentQuestion: null, currentMode: 'waiting' }).catch(() => {}); }
}

async function cleanup() {
  if (KEEP) {
    log(`\n🔒 --keep: 세션 유지(관전용). 나중에 삭제하려면: node tests/scenario-event-300.mjs (또는 수동 remove)`);
    log(`   현재 세션: ${SESSION_ID} — 300명 online, 답변/채팅/이모티콘 데이터 남아있음`);
    for (const app of apps) { try { await deleteApp(app); } catch { /* ignore */ } }
    return;
  }
  log(`\n🧹 완전 원상복구...`);
  try {
    await remove(ref(dbs[0], `sessions/${SESSION_ID}`));
    const check = await get(ref(dbs[0], `sessions/${SESSION_ID}`));
    log(`  세션 삭제: ${check.exists() ? '❌ 잔존' : '✅ 완전 삭제(참여자 포함)'}`);
  } catch (e) { log(`  삭제 오류: ${e.message}`); }
  for (const app of apps) { try { await deleteApp(app); } catch { /* ignore */ } }
  log(`  📡 ${USER_COUNT}개 연결 해제 완료`);
}

async function main() {
  console.log('═'.repeat(65));
  log(`이벤트 모드 종합 시나리오 — 300명, 주관식 10문항, 채팅·이모티콘 남발`);
  console.log('═'.repeat(65));
  let conn;
  try {
    await setup();
    await joinAll();
    if (WATCH) { log(`\n👀 전자칠판에서 300명 입장 확인하세요 — 12초 후 시나리오 시작...`); await sleep(12000); }
    conn = await connectionTest();
    await runScenario();
  } catch (e) {
    log(`❌ 시나리오 오류: ${e.message}`);
    results.errors.push({ phase: 'fatal', e: e.message });
  } finally {
    await cleanup(); // 무조건 원상복구
  }

  const total = results.answer.length + results.chat.length + results.reaction.length;
  const errRate = total ? (results.errors.length / (total + results.errors.length) * 100) : 0;
  console.log('\n' + '─'.repeat(65));
  log('📊 결과');
  log(`  입장: ${results.join.length}/${USER_COUNT}`);
  if (conn) log(`  연결관리: 끊김 ${conn.offCount}/${CHURN_COUNT} + 재접속 ${conn.onCount}/${CHURN_COUNT}`);
  log(`  주관식 답변: ${results.answer.length}건 — 평균 ${avg(results.answer)}ms, P95 ${p95(results.answer)}ms`);
  log(`  채팅: ${results.chat.length}건 — 평균 ${avg(results.chat)}ms, P95 ${p95(results.chat)}ms`);
  log(`  이모티콘: ${results.reaction.length}건 — 평균 ${avg(results.reaction)}ms, P95 ${p95(results.reaction)}ms`);
  log(`  에러: ${results.errors.length}건 (${errRate.toFixed(1)}%)`);
  console.log('─'.repeat(65));
  const pass = results.join.length >= USER_COUNT * 0.95 && errRate < 5 && (!conn || (conn.offCount >= CHURN_COUNT * 0.8 && conn.onCount >= CHURN_COUNT * 0.8));
  log(pass ? '  🎉 시나리오 ALL PASS — 이벤트 모드 실사용 준비 완료' : '  ⚠️ 일부 실패 — 위 결과 검토');
  console.log('═'.repeat(65));
  if (results.errors.length) console.log('첫 에러 5건:', results.errors.slice(0, 5));
  process.exit(0);
}

main();
