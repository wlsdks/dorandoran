if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000') throw new Error('부하/정리 도구는 로컬 demo 에뮬레이터에서만 실행하세요.');
/**
 * 200명 테스트 세션 — 브라우저에서 확인용 (정리 전까지 유지)
 * Ctrl+C로 종료하면 자동 정리
 */

import { initializeApp, deleteApp } from 'firebase/app';
import { getDatabase, ref, set, push, update, remove } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCsRs1BTT1NphOpbkoAwKn7rnrdQk16R2I",
  authDomain: "jinan-6c884.firebaseapp.com",
  databaseURL: "http://127.0.0.1:9000/?ns=demo-dorandoran",
  projectId: "demo-dorandoran",
  storageBucket: "jinan-6c884.firebasestorage.app",
  messagingSenderId: "956378670080",
  appId: "1:956378670080:web:2147d0766564dd00dde4e5"
};

const SESSION_ID = 'load_test_live';
const USER_COUNT = 200;

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

function log(msg) {
  process.stdout.write(`[${new Date().toLocaleTimeString()}] ${msg}\n`);
}

async function setup() {
  log(`세션 생성 중... (${SESSION_ID})`);

  // Create session
  await set(ref(db, `sessions/${SESSION_ID}`), {
    courseName: '부하 테스트 (200명)',
    status: 'active',
    currentMode: 'waiting',
    currentQuestion: null,
    createdAt: Date.now(),
  });

  // Create test questions
  await set(ref(db, `sessions/${SESSION_ID}/questions/lt_q1`), {
    title: '가장 좋아하는 프로그래밍 언어는?',
    type: 'choice',
    options: ['JavaScript', 'Python', 'Java', 'Go'],
  });

  await set(ref(db, `sessions/${SESSION_ID}/questions/lt_q2`), {
    title: 'DoranDoran 서비스 만족도는?',
    type: 'choice',
    options: ['매우 만족', '만족', '보통', '불만족'],
  });

  // Add 200 participants
  log(`${USER_COUNT}명 입장 중...`);
  const names = ['민준', '서연', '하준', '지우', '서준', '하윤', '도윤', '지유', '시우', '수아',
    '주원', '지아', '지호', '수빈', '유준', '예은', '현우', '하은', '준서', '소율',
    '예준', '다은', '건우', '유나', '윤우', '채원', '지민', '은서', '선우', '이서'];

  for (let batch = 0; batch < USER_COUNT; batch += 20) {
    const updates = {};
    for (let i = batch; i < Math.min(batch + 20, USER_COUNT); i++) {
      const pid = `lt_user_${String(i).padStart(4, '0')}`;
      const name = names[i % names.length] + (Math.floor(i / names.length) || '');
      updates[`sessions/${SESSION_ID}/participants/${pid}`] = {
        nickname: name,
        joinedAt: Date.now(),
        online: Math.random() > 0.1, // 90% online
      };
    }
    await update(ref(db), updates);
    if ((batch + 20) % 50 === 0) log(`  ${Math.min(batch + 20, USER_COUNT)}/${USER_COUNT} 입장 완료`);
  }

  // Simulate some votes on q1
  log(`투표 시뮬레이션 중...`);
  const options = ['JavaScript', 'Python', 'Java', 'Go'];
  const voteUpdates = {};
  for (let i = 0; i < USER_COUNT; i++) {
    const pid = `lt_user_${String(i).padStart(4, '0')}`;
    voteUpdates[`sessions/${SESSION_ID}/questions/lt_q1/votes/${pid}`] = {
      value: options[Math.floor(Math.random() * options.length)],
      timestamp: Date.now(),
    };
  }
  await update(ref(db), voteUpdates);

  // Activate question
  await update(ref(db, `sessions/${SESSION_ID}`), {
    currentQuestion: 'lt_q1',
    currentMode: 'poll',
  });

  // Add some reactions
  for (let i = 0; i < 20; i++) {
    await push(ref(db, `sessions/${SESSION_ID}/reactions`), {
      type: ['thumbsUp', 'fire', 'heart', 'laugh', 'clap'][Math.floor(Math.random() * 5)],
      timestamp: Date.now(),
    });
  }

  // Add some hand raises
  for (let i = 0; i < 8; i++) {
    const pid = `lt_user_${String(i * 25).padStart(4, '0')}`;
    await set(ref(db, `sessions/${SESSION_ID}/handRaises/${pid}`), {
      nickname: names[i],
      raised: true,
      raisedAt: Date.now(),
    });
  }

  log(`\n✅ 세션 준비 완료!`);
  log(`\n📱 학생 화면: http://localhost:5173/?s=${SESSION_ID}`);
  log(`🖥️  강사 화면에서: 세션 ID "${SESSION_ID}" 검색`);
  log(`\n⏳ Ctrl+C를 누르면 테스트 데이터를 정리합니다...\n`);
}

async function cleanup() {
  log(`\n🧹 테스트 데이터 정리 중...`);
  try {
    await remove(ref(db, `sessions/${SESSION_ID}`));
    log(`✅ 세션 삭제 완료`);
  } catch (err) {
    log(`⚠️ 정리 실패: ${err.message}`);
  }
  await deleteApp(app);
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

await setup();

// Keep alive
setInterval(() => {}, 60000);
