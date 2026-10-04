import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { app } from './firebase';

// 별도 모듈 — main bundle 분리용. 학생 vote 흐름엔 storage 미사용이라
// SubmitPage / AdminPage(라이브 심사) 청크에서만 다운로드.
export const storage = getStorage(app);

if (import.meta.env.VITE_FIREBASE_EMULATORS === 'true') connectStorageEmulator(storage, '127.0.0.1', 9199);
