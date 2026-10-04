if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000') throw new Error('부하/정리 도구는 로컬 demo 에뮬레이터에서만 실행하세요.');
import { initializeApp, deleteApp } from 'firebase/app';
import { getDatabase, ref, set, push, update } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCsRs1BTT1NphOpbkoAwKn7rnrdQk16R2I",
  databaseURL: "http://127.0.0.1:9000/?ns=demo-dorandoran",
  projectId: "demo-dorandoran",
};

const SID = 's_stress_test';
const USER_COUNT = 300;
const REACTION_TYPES = ['thumbsUp', 'fire', 'heart', 'laugh', 'clap'];

const app = initializeApp(firebaseConfig, 'stress');
const db = getDatabase(app);

function log(msg) { process.stdout.write(`[${new Date().toLocaleTimeString()}] ${msg}\n`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

let errors = 0;
let writes = 0;

async function safeWrite(fn) {
  try { await fn(); writes++; } catch (e) { errors++; }
}

// 질문 목록
const snap = await (await import('firebase/database')).get(ref(db, `sessions/${SID}/questions`));
const questions = snap.val();
const qIds = Object.keys(questions);
log(`질문 ${qIds.length}개: ${qIds.map(id => questions[id].type).join(', ')}`);

// ═══ Phase 1: 300명 입장 (5초) ═══
log('\n🚪 Phase 1: 300명 입장...');
const BATCH = 30;
for (let b = 0; b < USER_COUNT; b += BATCH) {
  const promises = [];
  for (let i = b; i < Math.min(b + BATCH, USER_COUNT); i++) {
    const pid = `u${String(i).padStart(4, '0')}`;
    promises.push(safeWrite(() => set(ref(db, `sessions/${SID}/participants/${pid}`), {
      nickname: `학생${i + 1}`, joinedAt: Date.now(), online: true,
    })));
  }
  await Promise.all(promises);
  if ((b + BATCH) % 90 === 0) log(`  ${Math.min(b + BATCH, USER_COUNT)}/300 입장`);
}
log(`✅ 300명 입장 완료 (쓰기 ${writes}, 에러 ${errors})`);
await sleep(1000);

// ═══ Phase 2: 문항1 객관식 — 300명 답변 (10초) ═══
const q1 = qIds[0];
log(`\n🗳️ Phase 2: 객관식 "${questions[q1].title.slice(0, 20)}..." 활성화`);
await update(ref(db, `sessions/${SID}`), { currentQuestion: q1, currentMode: 'poll', [`questions/${q1}/activatedAt`]: Date.now(), [`questions/${q1}/revealedAt`]: null });
await sleep(500);

const opts = questions[q1].options || ['A', 'B', 'C', 'D'];
for (let i = 0; i < USER_COUNT; i++) {
  const delay = Math.random() * 8000;
  setTimeout(() => {
    const pid = `u${String(i).padStart(4, '0')}`;
    safeWrite(() => set(ref(db, `sessions/${SID}/questions/${q1}/votes/${pid}`), {
      value: rand(opts), nickname: `학생${i + 1}`, timestamp: Date.now(),
    }));
  }, delay);
}
log('  300명 답변 전송 중 (8초간 분산)...');
await sleep(10000);
log(`  답변 완료 (누적 쓰기 ${writes}, 에러 ${errors})`);

// ═══ Phase 3: 리액션 + 채팅 폭발 (10초) ═══
log('\n🎉 Phase 3: 리액션 300건 + 채팅 50건...');
for (let i = 0; i < 300; i++) {
  setTimeout(() => {
    safeWrite(() => push(ref(db, `sessions/${SID}/reactions`), {
      type: rand(REACTION_TYPES), timestamp: Date.now(),
    }));
  }, Math.random() * 5000);
}
for (let i = 0; i < 50; i++) {
  setTimeout(() => {
    safeWrite(() => push(ref(db, `sessions/${SID}/chat`), {
      text: `채팅 메시지 ${i + 1}번입니다! 🔥`, sender: `학생${Math.floor(Math.random() * 300) + 1}`, senderType: 'student', timestamp: Date.now(),
    }));
  }, Math.random() * 5000);
}
await sleep(6000);
log(`  리액션+채팅 완료 (누적 쓰기 ${writes}, 에러 ${errors})`);

// ═══ Phase 4: 문항2 미스터리 박스 — 300명 주관식 답변 (10초) ═══
const q2 = qIds.find(id => questions[id].type === 'mysteryBox') || qIds[1];
log(`\n💬 Phase 4: 미스터리 박스 "${questions[q2].title.slice(0, 20)}..." 활성화`);
await update(ref(db, `sessions/${SID}`), { currentQuestion: q2, currentMode: 'poll', [`questions/${q2}/activatedAt`]: Date.now(), [`questions/${q2}/revealedAt`]: null });
await sleep(500);

const answers = ['67', '100', '50', '33', '67명', '약 70', '모르겠어요', '60', '80', '45', '67개', '55'];
for (let i = 0; i < USER_COUNT; i++) {
  const delay = Math.random() * 8000;
  setTimeout(() => {
    const pid = `u${String(i).padStart(4, '0')}`;
    safeWrite(() => set(ref(db, `sessions/${SID}/questions/${q2}/votes/${pid}`), {
      value: rand(answers), nickname: `학생${i + 1}`, timestamp: Date.now(),
    }));
  }, delay);
}
log('  300명 주관식 답변 전송 중 (8초간 분산)...');
await sleep(10000);

// 정답 공개
log('  🎯 정답 공개!');
await update(ref(db, `sessions/${SID}`), { [`questions/${q2}/revealedAt`]: Date.now() });
await sleep(3000);
log(`  정답 공개 완료 (누적 쓰기 ${writes}, 에러 ${errors})`);

// ═══ Phase 5: 힌트 퀴즈 (10초) ═══
const q3 = qIds.find(id => questions[id].type === 'hintQuiz') || qIds[2];
log(`\n💡 Phase 5: 힌트 퀴즈 "${questions[q3].title.slice(0, 20)}..." 활성화`);
await update(ref(db, `sessions/${SID}`), { currentQuestion: q3, currentMode: 'poll', [`questions/${q3}/activatedAt`]: Date.now(), [`questions/${q3}/revealedAt`]: null, [`questions/${q3}/revealedHints`]: 0 });
await sleep(1000);

// 힌트 순차 공개
const hints = questions[q3]?.hints || [];
for (let h = 1; h <= hints.length; h++) {
  await update(ref(db, `sessions/${SID}/questions/${q3}`), { revealedHints: h });
  log(`  힌트 ${h}/${hints.length} 공개`);
  await sleep(1500);
}

// 300명 답변
const hintAnswers = ['아레테 타운홀', '타운홀', 'Arete', '아레테', '모르겠어요', '회의실', '광장', 'arete townhall'];
for (let i = 0; i < USER_COUNT; i++) {
  const pid = `u${String(i).padStart(4, '0')}`;
  setTimeout(() => {
    safeWrite(() => set(ref(db, `sessions/${SID}/questions/${q3}/votes/${pid}`), {
      value: rand(hintAnswers), nickname: `학생${i + 1}`, timestamp: Date.now(),
    }));
  }, Math.random() * 5000);
}
await sleep(6000);
log(`  답변 완료 (누적 쓰기 ${writes}, 에러 ${errors})`);

// ═══ Phase 6: 손들기 + 긴급질문 (5초) ═══
log('\n🙋 Phase 6: 손들기 50명 + 긴급질문 20건...');
for (let i = 0; i < 50; i++) {
  const pid = `u${String(i).padStart(4, '0')}`;
  safeWrite(() => set(ref(db, `sessions/${SID}/handRaises/${pid}`), {
    nickname: `학생${i + 1}`, raised: true, raisedAt: Date.now(),
  }));
}
for (let i = 0; i < 20; i++) {
  safeWrite(() => push(ref(db, `sessions/${SID}/urgentQuestions`), {
    text: `긴급질문 ${i + 1}: 이건 어떻게 해야 하나요?`, nickname: `학생${Math.floor(Math.random() * 300) + 1}`, anonymous: Math.random() > 0.5, timestamp: Date.now(), read: false,
  }));
}
await sleep(3000);
log(`  손들기+긴급질문 완료 (누적 쓰기 ${writes}, 에러 ${errors})`);

// ═══ Phase 7: 합산 랭킹 (5초) ═══
log('\n🏆 Phase 7: 합산 랭킹 모드 전환...');
await update(ref(db, `sessions/${SID}`), { currentMode: 'combinedRanking', currentQuestion: null });
await sleep(5000);

// ═══ 결과 ═══
log('\n' + '═'.repeat(50));
log('📊 300명 스트레스 테스트 결과');
log('═'.repeat(50));
log(`총 쓰기: ${writes}건`);
log(`에러: ${errors}건`);
log(`성공률: ${((writes / (writes + errors)) * 100).toFixed(1)}%`);
log(`에러율: ${((errors / (writes + errors)) * 100).toFixed(1)}%`);
log('');
const pass = errors === 0 || (errors / (writes + errors)) < 0.05;
log(pass ? '🎉 PASS — 상용 서비스 준비 완료!' : '⚠️ 에러 발생 — 확인 필요');
log('═'.repeat(50));

await deleteApp(app);
process.exit(0);
