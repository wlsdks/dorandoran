if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000') throw new Error('부하/정리 도구는 로컬 demo 에뮬레이터에서만 실행하세요.');
/**
 * Vote 부하 테스트 — 객관식/OX/퀴즈/워드클라우드 등 다양한 질문 유형 30명 동시 답변.
 *
 * 흐름:
 *   1. 강사가 admin에서 세션 생성 + 질문 활성화
 *   2. node scripts/load-test-votes.mjs <session-id> [n=30]
 *   3. 스크립트: 30 가짜 user join → 활성 질문 유형 감지 → 적절한 답변 형식으로 동시 vote
 *   4. 강사 화면에서 막대그래프/카운터 실시간 갱신 확인
 *   5. 끝나면 0명으로 정리
 */
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, remove, serverTimestamp } from 'firebase/database';

const FB_CONFIG = {
  apiKey: 'AIzaSyCsRs1BTT1NphOpbkoAwKn7rnrdQk16R2I',
  authDomain: 'jinan-6c884.firebaseapp.com',
  databaseURL: 'http://127.0.0.1:9000/?ns=demo-dorandoran',
  projectId: 'demo-dorandoran',
  storageBucket: 'jinan-6c884.firebasestorage.app',
  messagingSenderId: '956378670080',
  appId: '1:956378670080:web:2147d0766564dd00dde4e5',
};

const SID = process.argv[2];
const N = parseInt(process.argv[3] || '30', 10);
if (!SID) {
  console.error('Usage: node scripts/load-test-votes.mjs <session-id> [n=30]');
  process.exit(1);
}

const app = initializeApp(FB_CONFIG);
const db = getDatabase(app);

const clients = Array.from({ length: N }, (_, i) => ({
  idx: i + 1,
  pid: `vote_${String(i + 1).padStart(2, '0')}_${Math.random().toString(36).slice(2, 8)}`,
  nickname: `투표${i + 1}`,
}));

function ts() { return new Date().toISOString().slice(11, 19); }
function log(...args) { console.log(`[${ts()}]`, ...args); }

function pickAnswerForQuestion(q, idx) {
  const type = q.type;
  if (type === 'choice' || type === 'quiz') {
    const options = q.options || {};
    const keys = Object.keys(options);
    if (keys.length === 0) return null;
    // 30명이 분산되도록: 인덱스 기반 + 약간의 random
    return keys[(idx + Math.floor(Math.random() * 2)) % keys.length];
  }
  if (type === 'ox') {
    return Math.random() > 0.5 ? 'O' : 'X';
  }
  if (type === 'wordcloud') {
    const words = ['실전감', '집중', '재미', '협업', '도전', '몰입', '에너지', '아이디어', '창의', '협력', '발견', '시도'];
    return words[idx % words.length];
  }
  if (type === 'scale') {
    // 감정 온도계 — 1~10
    return String(Math.floor(Math.random() * 10) + 1);
  }
  if (type === 'debate') {
    return Math.random() > 0.5 ? 'pro' : 'con';
  }
  if (type === 'ranking') {
    const options = q.options || {};
    const keys = Object.keys(options);
    if (keys.length < 2) return null;
    // 랜덤 순열
    const shuffled = [...keys].sort(() => Math.random() - 0.5);
    return shuffled.join(',');
  }
  if (type === 'fillinblank') {
    return ['답변A', '답변B', '답변C', '답변D'][idx % 4];
  }
  if (type === 'check') {
    return 'done';
  }
  return null;
}

(async () => {
  log(`🎬 Vote load test — session=${SID}, N=${N}`);

  // 1) 동시 join
  log('▶ Step 1: 30명 동시 join');
  const t0 = Date.now();
  await Promise.allSettled(clients.map((c) =>
    set(ref(db, `sessions/${SID}/participants/${c.pid}`), {
      nickname: c.nickname,
      joinedAt: Date.now(),
      online: true,
    })
  ));
  log(`✔ Join in ${Date.now() - t0}ms`);

  // 2) 활성 질문 찾기
  const sessionSnap = await get(ref(db, `sessions/${SID}`));
  const session = sessionSnap.val() || {};
  const activeQid = session.currentQuestion;
  const q = session.questions?.[activeQid];
  if (!activeQid || !q) {
    log('❌ 활성 질문 없음. admin에서 질문 활성화 후 다시 시도.');
    await cleanup();
    process.exit(1);
  }
  log(`▶ Active question: ${activeQid} (type=${q.type})`);

  // 3) 30명 동시 vote
  log('▶ Step 2: 30명 동시 vote');
  const t1 = Date.now();
  const voteResults = await Promise.allSettled(clients.map(async (c, i) => {
    const value = pickAnswerForQuestion(q, i);
    if (!value) throw new Error(`unsupported type: ${q.type}`);
    await set(ref(db, `sessions/${SID}/questions/${activeQid}/votes/${c.pid}`), {
      value,
      nickname: c.nickname.slice(0, 10),
    });
  }));
  const voteOk = voteResults.filter((r) => r.status === 'fulfilled').length;
  const voteFail = voteResults.filter((r) => r.status === 'rejected');
  log(`✔ Vote: ${voteOk}/${N} 성공, ${Date.now() - t1}ms`);
  if (voteFail.length) {
    log('❌ Vote 실패:', voteFail.slice(0, 3).map((r) => r.reason?.message).join(' / '));
  }

  // 4) 분포 확인
  await new Promise((r) => setTimeout(r, 1500));
  const votesSnap = await get(ref(db, `sessions/${SID}/questions/${activeQid}/votes`));
  const votes = votesSnap.val() || {};
  const distribution = {};
  Object.values(votes).forEach((v) => {
    distribution[v.value] = (distribution[v.value] || 0) + 1;
  });
  log(`✔ 분포: ${JSON.stringify(distribution)}`);
  log(`✔ 총 ${Object.keys(votes).length} votes 기록됨`);

  // 5) 정리
  log('▶ Step 3: 정리 (0명으로)');
  await cleanup();
  log('✔ 정리 완료 (참여자 + 투표 모두 삭제)');

  process.exit(0);
})();

async function cleanup() {
  // 참여자 + 활성 질문의 vote들 삭제
  await Promise.allSettled(clients.map((c) =>
    remove(ref(db, `sessions/${SID}/participants/${c.pid}`))
  ));
  // votes도 삭제 (강사가 다시 활성화 시 깨끗하게)
  const sessionSnap = await get(ref(db, `sessions/${SID}`));
  const activeQid = sessionSnap.val()?.currentQuestion;
  if (activeQid) {
    await Promise.allSettled(clients.map((c) =>
      remove(ref(db, `sessions/${SID}/questions/${activeQid}/votes/${c.pid}`))
    ));
  }
}
