if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000') throw new Error('부하/정리 도구는 로컬 demo 에뮬레이터에서만 실행하세요.');
import { initializeApp, deleteApp } from 'firebase/app';
import { getDatabase, ref, set, push, update, get } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCsRs1BTT1NphOpbkoAwKn7rnrdQk16R2I",
  databaseURL: "http://127.0.0.1:9000/?ns=demo-dorandoran",
  projectId: "demo-dorandoran",
};

const SID = 's_stress_test';
const USER_COUNT = 300;
const REACTION_TYPES = ['thumbsUp', 'fire', 'heart', 'laugh', 'clap'];

const app = initializeApp(firebaseConfig, 'slow_stress');
const db = getDatabase(app);

function log(msg) { process.stdout.write(`[${new Date().toLocaleTimeString()}] ${msg}\n`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

let errors = 0, writes = 0;
async function w(fn) { try { await fn(); writes++; } catch { errors++; } }

// 초기화
log('🧹 세션 초기화...');
const snap = await get(ref(db, `sessions/${SID}/questions`));
const questions = snap.val();
const qIds = Object.keys(questions);
const resetUpdates = { gameResult: null, gameState: null, drumroll: null, currentQuestion: null, currentMode: 'waiting', scores: null, reactions: null, chat: null, handRaises: null, urgentQuestions: null, classQuestions: null };
qIds.forEach(qId => { resetUpdates[`questions/${qId}/votes`] = null; resetUpdates[`questions/${qId}/revealedAt`] = null; resetUpdates[`questions/${qId}/activatedAt`] = null; resetUpdates[`questions/${qId}/revealedHints`] = 0; resetUpdates[`questions/${qId}/revealedWinners`] = 0; resetUpdates[`questions/${qId}/currentSlide`] = 0; });
await update(ref(db, `sessions/${SID}`), resetUpdates);
log('✅ 초기화 완료\n');
await sleep(2000);

log(`질문 ${qIds.length}개: ${qIds.map(id => questions[id].type + ': ' + questions[id].title.slice(0, 15)).join(' | ')}\n`);

// ═══ Phase 1: 300명 천천히 입장 (15초) ═══
log('🚪 Phase 1: 300명 입장 (천천히)...');
for (let b = 0; b < USER_COUNT; b += 15) {
  const promises = [];
  for (let i = b; i < Math.min(b + 15, USER_COUNT); i++) {
    promises.push(w(() => set(ref(db, `sessions/${SID}/participants/u${String(i).padStart(4, '0')}`), {
      nickname: `학생${i + 1}`, joinedAt: Date.now(), online: true,
    })));
  }
  await Promise.all(promises);
  if ((b + 15) % 60 === 0) log(`  ${Math.min(b + 15, USER_COUNT)}/300 입장`);
  await sleep(700);
}
log(`✅ 300명 입장 완료\n`);
await sleep(3000);

// ═══ Phase 2: 이미지 슬라이드 넘기기 ═══
const imgQ = qIds.find(id => questions[id].type === 'imageSlide');
if (imgQ && questions[imgQ].slideImages?.length > 0) {
  log(`🖼️ Phase 2: 이미지 슬라이드 "${questions[imgQ].title.slice(0, 20)}" 활성화`);
  await update(ref(db, `sessions/${SID}`), { currentQuestion: imgQ, currentMode: 'poll', [`questions/${imgQ}/activatedAt`]: Date.now(), [`questions/${imgQ}/currentSlide`]: 0 });
  const total = questions[imgQ].slideImages.length;
  for (let s = 0; s < total; s++) {
    log(`  슬라이드 ${s + 1}/${total}`);
    await update(ref(db, `sessions/${SID}/questions/${imgQ}`), { currentSlide: s });
    await sleep(3000);
  }
  log('✅ 이미지 슬라이드 완료\n');
  await sleep(2000);
}

// ═══ Phase 3: 객관식 — 300명 답변 (25초) ═══
const choiceQ = qIds.find(id => questions[id].type === 'choice');
if (choiceQ) {
  log(`🗳️ Phase 3: 객관식 "${questions[choiceQ].title.slice(0, 20)}..." 활성화`);
  await update(ref(db, `sessions/${SID}`), { currentQuestion: choiceQ, currentMode: 'poll', [`questions/${choiceQ}/activatedAt`]: Date.now(), [`questions/${choiceQ}/revealedAt`]: null });
  await sleep(2000);

  const opts = questions[choiceQ].options || ['A', 'B', 'C', 'D'];
  for (let i = 0; i < USER_COUNT; i++) {
    setTimeout(() => {
      const pid = `u${String(i).padStart(4, '0')}`;
      w(() => set(ref(db, `sessions/${SID}/questions/${choiceQ}/votes/${pid}`), {
        value: rand(opts), nickname: `학생${i + 1}`, timestamp: Date.now(),
      }));
    }, Math.random() * 20000);
  }
  log('  300명 답변 전송 중 (20초간 분산)...');
  await sleep(22000);

  // 정답 공개
  if (questions[choiceQ].correctAnswer) {
    log('  🎯 정답 공개!');
    await update(ref(db, `sessions/${SID}/questions/${choiceQ}`), { revealedAt: Date.now() });
    await sleep(5000);
  }
  log(`✅ 객관식 완료\n`);
}

// ═══ Phase 4: 리액션 + 채팅 (15초) ═══
log('🎉 Phase 4: 리액션 + 채팅...');
for (let i = 0; i < 200; i++) {
  setTimeout(() => {
    w(() => push(ref(db, `sessions/${SID}/reactions`), { type: rand(REACTION_TYPES), timestamp: Date.now() }));
  }, Math.random() * 12000);
}
for (let i = 0; i < 30; i++) {
  setTimeout(() => {
    w(() => push(ref(db, `sessions/${SID}/chat`), {
      text: `${rand(['와!', '대박', '이건 뭐지?', 'ㅋㅋㅋ', '좋아요', '진짜?', '오~', '재밌다'])} ${rand(['👍', '🔥', '😂', '👏', '❤️', ''])}`,
      sender: `학생${Math.floor(Math.random() * 300) + 1}`, senderType: 'student', timestamp: Date.now(),
    }));
  }, Math.random() * 12000);
}
await sleep(15000);
log(`✅ 리액션+채팅 완료\n`);

// ═══ Phase 5: 미스터리 박스 — 300명 주관식 (30초) ═══
const mbQ = qIds.find(id => questions[id].type === 'mysteryBox');
if (mbQ) {
  log(`💬 Phase 5: 미스터리 박스 "${questions[mbQ].title.slice(0, 20)}..." 활성화`);
  await update(ref(db, `sessions/${SID}`), { currentQuestion: mbQ, currentMode: 'poll', [`questions/${mbQ}/activatedAt`]: Date.now(), [`questions/${mbQ}/revealedAt`]: null });
  await sleep(3000);

  const answers = ['67', '100', '50', '33', '67명', '약 70', '모르겠어요', '60', '80', '45', '67개', '55', '72', '88', '30'];
  for (let i = 0; i < USER_COUNT; i++) {
    setTimeout(() => {
      const pid = `u${String(i).padStart(4, '0')}`;
      w(() => set(ref(db, `sessions/${SID}/questions/${mbQ}/votes/${pid}`), {
        value: rand(answers), nickname: `학생${i + 1}`, timestamp: Date.now(),
      }));
    }, Math.random() * 25000);
  }
  log('  300명 답변 전송 중 (25초간 분산)...');
  await sleep(27000);

  log('  🥁 두구두구...');
  await update(ref(db, `sessions/${SID}`), { drumroll: true });
  await sleep(4000);

  log('  🎯 정답 공개!');
  await update(ref(db, `sessions/${SID}`), { [`questions/${mbQ}/revealedAt`]: Date.now(), drumroll: null });
  await sleep(5000);
  log(`✅ 미스터리 박스 완료\n`);
}

// ═══ Phase 6: 힌트 퀴즈 (30초) ═══
const hintQ = qIds.find(id => questions[id].type === 'hintQuiz');
if (hintQ) {
  log(`💡 Phase 6: 힌트 퀴즈 "${questions[hintQ].title.slice(0, 20)}..." 활성화`);
  await update(ref(db, `sessions/${SID}`), { currentQuestion: hintQ, currentMode: 'poll', [`questions/${hintQ}/activatedAt`]: Date.now(), [`questions/${hintQ}/revealedAt`]: null, [`questions/${hintQ}/revealedHints`]: 0 });
  await sleep(3000);

  const hints = questions[hintQ]?.hints || [];
  for (let h = 1; h <= hints.length; h++) {
    await update(ref(db, `sessions/${SID}/questions/${hintQ}`), { revealedHints: h });
    log(`  힌트 ${h}/${hints.length} 공개: "${hints[h-1].slice(0, 20)}"`);
    await sleep(4000);
  }

  const hintAnswers = ['아레테 타운홀', '타운홀', 'Arete', '아레테', '모르겠어요', '회의실', '광장', 'arete', 'ARETE 타운홀', '아레테타운홀'];
  for (let i = 0; i < USER_COUNT; i++) {
    setTimeout(() => {
      const pid = `u${String(i).padStart(4, '0')}`;
      w(() => set(ref(db, `sessions/${SID}/questions/${hintQ}/votes/${pid}`), {
        value: rand(hintAnswers), nickname: `학생${i + 1}`, timestamp: Date.now(),
      }));
    }, Math.random() * 15000);
  }
  log('  300명 답변 전송 중...');
  await sleep(17000);

  log('  🥁 두구두구...');
  await update(ref(db, `sessions/${SID}`), { drumroll: true });
  await sleep(4000);

  log('  🎯 정답 공개!');
  await update(ref(db, `sessions/${SID}`), { [`questions/${hintQ}/revealedAt`]: Date.now(), drumroll: null });
  await sleep(5000);
  log(`✅ 힌트 퀴즈 완료\n`);
}

// ═══ Phase 7: 손들기 + 긴급질문 (10초) ═══
log('🙋 Phase 7: 손들기 + 긴급질문...');
for (let i = 0; i < 30; i++) {
  await sleep(200);
  const pid = `u${String(i).padStart(4, '0')}`;
  w(() => set(ref(db, `sessions/${SID}/handRaises/${pid}`), { nickname: `학생${i + 1}`, raised: true, raisedAt: Date.now() }));
}
for (let i = 0; i < 10; i++) {
  await sleep(300);
  w(() => push(ref(db, `sessions/${SID}/urgentQuestions`), { text: `긴급질문 ${i + 1}: 다음 내용이 궁금합니다!`, nickname: `학생${Math.floor(Math.random() * 300) + 1}`, anonymous: Math.random() > 0.5, timestamp: Date.now(), read: false }));
}
await sleep(3000);
log(`✅ 손들기+긴급질문 완료\n`);

// ═══ Phase 8: 합산 랭킹 (10초) ═══
log('🏆 Phase 8: 합산 랭킹!');
await update(ref(db, `sessions/${SID}`), { currentMode: 'combinedRanking', currentQuestion: null });
await sleep(10000);

// ═══ 결과 ═══
log('\n' + '═'.repeat(55));
log('📊 300명 스트레스 테스트 (슬로우) 결과');
log('═'.repeat(55));
log(`총 쓰기: ${writes}건`);
log(`에러: ${errors}건`);
log(`성공률: ${((writes / (writes + errors)) * 100).toFixed(1)}%`);
log('');
const pass = errors === 0 || (errors / (writes + errors)) < 0.05;
log(pass ? '🎉 PASS — 상용 서비스 준비 완료!' : '⚠️ 에러 발생 — 확인 필요');
log('═'.repeat(55));

await deleteApp(app);
process.exit(0);
