if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000') throw new Error('부하/정리 도구는 로컬 demo 에뮬레이터에서만 실행하세요.');
/**
 * 테스트 세션 정리 — 운영 DB에서 throwaway 세션 데이터 삭제.
 *
 * 안전: 명시된 세션 ID만 삭제. 외 데이터는 건드리지 않음.
 *
 * 사용: node scripts/cleanup-test-sessions.mjs <sid1> [sid2] ...
 */
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, remove, get } from 'firebase/database';

const FB_CONFIG = {
  apiKey: 'AIzaSyCsRs1BTT1NphOpbkoAwKn7rnrdQk16R2I',
  authDomain: 'jinan-6c884.firebaseapp.com',
  databaseURL: 'http://127.0.0.1:9000/?ns=demo-dorandoran',
  projectId: 'demo-dorandoran',
  storageBucket: 'jinan-6c884.firebasestorage.app',
  messagingSenderId: '956378670080',
  appId: '1:956378670080:web:2147d0766564dd00dde4e5',
};

const sids = process.argv.slice(2);
if (sids.length === 0) {
  console.error('Usage: node scripts/cleanup-test-sessions.mjs <sid1> [sid2] ...');
  process.exit(1);
}

const app = initializeApp(FB_CONFIG);
const db = getDatabase(app);

function ts() { return new Date().toISOString().slice(11, 19); }
function log(...args) { console.log(`[${ts()}]`, ...args); }

(async () => {
  for (const sid of sids) {
    const snap = await get(ref(db, `sessions/${sid}`));
    if (!snap.exists()) {
      log(`⏭  ${sid} — 없음 (skip)`);
      continue;
    }
    const data = snap.val();
    const participants = Object.keys(data.participants || {}).length;
    const questions = Object.keys(data.questions || {}).length;
    log(`🗑  ${sid} — participants=${participants}, questions=${questions} 삭제 중...`);
    await remove(ref(db, `sessions/${sid}`));
    log(`✔ ${sid} 삭제 완료`);
  }
  log('✨ 모든 정리 완료');
  process.exit(0);
})();
