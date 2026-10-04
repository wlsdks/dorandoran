if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000') throw new Error('부하/정리 도구는 로컬 demo 에뮬레이터에서만 실행하세요.');
import { initializeApp, deleteApp } from 'firebase/app';
import { getDatabase, ref, set, push, update, get } from 'firebase/database';

const firebaseConfig = { apiKey: "AIzaSyCsRs1BTT1NphOpbkoAwKn7rnrdQk16R2I", databaseURL: "http://127.0.0.1:9000/?ns=demo-dorandoran", projectId: "demo-dorandoran" };
const SID = 's_stress_test';
const USERS = 150;
const REACTIONS = ['thumbsUp', 'fire', 'heart', 'laugh', 'clap'];

const app = initializeApp(firebaseConfig, 'final');
const db = getDatabase(app);
function log(msg) { process.stdout.write(`[${new Date().toLocaleTimeString()}] ${msg}\n`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
let errors = 0, writes = 0;
async function w(fn) { try { await fn(); writes++; } catch { errors++; } }

const snap = await get(ref(db, `sessions/${SID}/questions`));
const questions = snap.val();
if (!questions) { log('❌ 세션에 질문이 없습니다. 먼저 세션을 생성해주세요.'); process.exit(1); }
const qIds = Object.keys(questions);

// ═══ Phase 0: 기존 데이터 클리어 (0명부터 시작) ═══
log('🧹 Phase 0: 기존 데이터 클리어...');
await set(ref(db, `sessions/${SID}/participants`), null);
await set(ref(db, `sessions/${SID}/reactions`), null);
await set(ref(db, `sessions/${SID}/chat`), null);
await set(ref(db, `sessions/${SID}/gameResult`), null);
await set(ref(db, `sessions/${SID}/drumroll`), null);
// 각 질문의 votes, revealedAt 초기화
for (const qId of qIds) {
  await update(ref(db, `sessions/${SID}/questions/${qId}`), { votes: null, revealedAt: null, revealedHints: null, activatedAt: null, currentSlide: null });
}
await update(ref(db, `sessions/${SID}`), { currentMode: 'waiting', currentQuestion: null, status: 'active' });
log('✅ 클리어 완료 — 0명에서 시작\n');
await sleep(2000);

// ═══ Phase 1: 150명 현실적 입장 (1초에 1~3명) ═══
log('🚪 Phase 1: 150명 입장 (1초 1명, 가끔 2~3명 동시)...');
let joined = 0;
while (joined < USERS) {
  // 1~3명 동시 입장 (70% 확률 1명, 20% 2명, 10% 3명)
  const r = Math.random();
  const batch = Math.min(r < 0.7 ? 1 : r < 0.9 ? 2 : 3, USERS - joined);
  const p = [];
  for (let i = 0; i < batch; i++) {
    const idx = joined + i;
    p.push(w(() => set(ref(db, `sessions/${SID}/participants/u${String(idx).padStart(4,'0')}`), { nickname: `학생${idx+1}`, joinedAt: Date.now(), online: true })));
  }
  await Promise.all(p);
  joined += batch;
  if (joined % 30 === 0 || joined >= USERS) log(`  ${joined}/${USERS}`);
  await sleep(batch === 1 ? 1000 : 700);
}
log('✅ 150명 입장 완료\n');
await sleep(3000);

// ═══ Phase 2: 이미지 슬라이드 ═══
const imgQ = qIds.find(id => questions[id].type === 'imageSlide');
if (imgQ && questions[imgQ].slideImages?.length) {
  log('🖼️ Phase 2: 이미지 슬라이드');
  await update(ref(db, `sessions/${SID}`), { currentQuestion: imgQ, currentMode: 'poll', [`questions/${imgQ}/activatedAt`]: Date.now(), [`questions/${imgQ}/currentSlide`]: 0 });
  for (let s = 0; s < questions[imgQ].slideImages.length; s++) {
    await update(ref(db, `sessions/${SID}/questions/${imgQ}`), { currentSlide: s });
    log(`  ${s+1}/${questions[imgQ].slideImages.length}`);
    await sleep(3500);
  }
  log('✅ 이미지 완료\n');
  await sleep(2000);
}

// ═══ Phase 3: 객관식 + 리액션 동시 ═══
const choiceQ = qIds.find(id => questions[id].type === 'choice');
if (choiceQ) {
  log('🗳️ Phase 3: 객관식 + 리액션 동시');
  await update(ref(db, `sessions/${SID}`), { currentQuestion: choiceQ, currentMode: 'poll', [`questions/${choiceQ}/activatedAt`]: Date.now(), [`questions/${choiceQ}/revealedAt`]: null });
  await sleep(2000);
  const opts = questions[choiceQ].options || ['A','B','C','D'];
  for (let i = 0; i < USERS; i++) {
    setTimeout(() => {
      w(() => set(ref(db, `sessions/${SID}/questions/${choiceQ}/votes/u${String(i).padStart(4,'0')}`), { value: rand(opts), nickname: `학생${i+1}`, timestamp: Date.now() }));
      if (Math.random() < 0.3) w(() => push(ref(db, `sessions/${SID}/reactions`), { type: rand(REACTIONS), timestamp: Date.now() }));
    }, Math.random() * 20000);
  }
  log('  답변+리액션 전송 중 (20초)...');
  await sleep(22000);
  // 두구두구 → 정답 공개
  if (questions[choiceQ].correctAnswer) {
    log('  🥁 두구두구...');
    await update(ref(db, `sessions/${SID}`), { drumroll: true });
    await sleep(4000);
    log('  🎯 정답 공개!');
    await update(ref(db, `sessions/${SID}`), { [`questions/${choiceQ}/revealedAt`]: Date.now(), drumroll: null });
    await sleep(5000);
  }
  log('✅ 객관식 완료\n');
}

// ═══ Phase 4: 미스터리 박스 ═══
const mbQ = qIds.find(id => questions[id].type === 'mysteryBox');
if (mbQ) {
  log('💬 Phase 4: 미스터리 박스');
  await update(ref(db, `sessions/${SID}`), { currentQuestion: mbQ, currentMode: 'poll', [`questions/${mbQ}/activatedAt`]: Date.now(), [`questions/${mbQ}/revealedAt`]: null });
  await sleep(3000);
  const ans = ['67','100','50','33','67명','약 70','모르겠어요','60','80','45'];
  for (let i = 0; i < USERS; i++) {
    setTimeout(() => {
      w(() => set(ref(db, `sessions/${SID}/questions/${mbQ}/votes/u${String(i).padStart(4,'0')}`), { value: rand(ans), nickname: `학생${i+1}`, timestamp: Date.now() }));
    }, Math.random() * 25000);
  }
  log('  답변 전송 중 (25초)...');
  // 채팅도 섞기
  for (let i = 0; i < 20; i++) {
    setTimeout(() => w(() => push(ref(db, `sessions/${SID}/chat`), { text: rand(['와 어렵다','모르겠어요 ㅋㅋ','67인가?','힌트 주세요!','대박']), sender: `학생${Math.floor(Math.random()*USERS)+1}`, senderType: 'student', timestamp: Date.now() })), Math.random() * 20000);
  }
  await sleep(27000);
  log('  🥁 두구두구...');
  await update(ref(db, `sessions/${SID}`), { drumroll: true });
  await sleep(4000);
  log('  🎯 정답 공개!');
  await update(ref(db, `sessions/${SID}`), { [`questions/${mbQ}/revealedAt`]: Date.now(), drumroll: null });
  await sleep(5000);
  log('✅ 미스터리 박스 완료\n');
}

// ═══ Phase 5: 힌트 퀴즈 ═══
const hintQ = qIds.find(id => questions[id].type === 'hintQuiz');
if (hintQ) {
  log('💡 Phase 5: 힌트 퀴즈');
  await update(ref(db, `sessions/${SID}`), { currentQuestion: hintQ, currentMode: 'poll', [`questions/${hintQ}/activatedAt`]: Date.now(), [`questions/${hintQ}/revealedAt`]: null, [`questions/${hintQ}/revealedHints`]: 0 });
  await sleep(3000);
  const hints = questions[hintQ]?.hints || [];
  for (let h = 1; h <= hints.length; h++) {
    await update(ref(db, `sessions/${SID}/questions/${hintQ}`), { revealedHints: h });
    log(`  힌트 ${h}/${hints.length}: "${hints[h-1].slice(0,25)}"`);
    await sleep(4000);
  }
  const ha = ['아레테 타운홀','타운홀','Arete','아레테','모르겠어요','회의실','arete','ARETE 타운홀'];
  for (let i = 0; i < USERS; i++) {
    setTimeout(() => w(() => set(ref(db, `sessions/${SID}/questions/${hintQ}/votes/u${String(i).padStart(4,'0')}`), { value: rand(ha), nickname: `학생${i+1}`, timestamp: Date.now() })), Math.random() * 15000);
  }
  log('  답변 전송 중...');
  await sleep(17000);
  log('  🥁 두구두구...');
  await update(ref(db, `sessions/${SID}`), { drumroll: true });
  await sleep(4000);
  log('  🎯 정답 공개!');
  await update(ref(db, `sessions/${SID}`), { [`questions/${hintQ}/revealedAt`]: Date.now(), drumroll: null });
  await sleep(5000);
  log('✅ 힌트 퀴즈 완료\n');
}

// ═══ Phase 6: 합산 랭킹 ═══
log('🏆 Phase 6: 합산 랭킹!');
await update(ref(db, `sessions/${SID}`), { currentMode: 'combinedRanking', currentQuestion: null });
await sleep(10000);

// ═══ 결과 ═══
log('\n' + '═'.repeat(55));
log(`📊 ${USERS}명 최종 스트레스 테스트 결과`);
log('═'.repeat(55));
log(`총 쓰기: ${writes}건`);
log(`에러: ${errors}건`);
log(`성공률: ${((writes/(writes+errors))*100).toFixed(1)}%`);
log('');
log(errors === 0 ? '🎉 ALL PASS — 상용 서비스 준비 완료!' : `⚠️ 에러 ${errors}건`);
log('═'.repeat(55));
await deleteApp(app);
process.exit(0);
