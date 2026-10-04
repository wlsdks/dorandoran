import { initializeApp } from 'firebase/app';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';

// Firebase Web SDK config — 환경 변수(.env / .env.local)에서 주입.
// 정책상 secret 아니지만(rules로 보호) fork 사용자가 본인 프로젝트로 갈음할 수 있도록 분리.
// `.env.example` 참고.
//
// firebase/storage는 학생 vote 흐름에 안 쓰이므로 main bundle에서 분리. 사용처는
// `@/lib/firebase-storage`에서 import (이미지 업로드 영역만 storage chunk 다운로드).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.databaseURL) {
  throw new Error(
    'Firebase config 누락 — `.env` 파일에 VITE_FIREBASE_* 변수를 채워주세요. (.env.example 참고)'
  );
}

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

if (import.meta.env.VITE_FIREBASE_EMULATORS === 'true') connectDatabaseEmulator(db, '127.0.0.1', 9000);
