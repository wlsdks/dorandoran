import { ref, push, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { auth } from '@/lib/auth-session';

/**
 * 운영에서 사용자 기기에서만 나는 오류(예: 윈도우 사진 업로드)를 원인과 함께 남긴다.
 * 개인정보·파일 내용은 보내지 않는다 — 기기 정보와 파일 형식·크기만.
 */
export function reportClientError(area, error, context = {}) {
  try {
    if (!auth.currentUser) return;
    const clip = (v, n = 300) => String(v ?? '').slice(0, n);
    push(ref(db, 'clientErrors'), {
      area: clip(area, 40),
      code: clip(error?.code, 80),
      message: clip(error?.message),
      context: clip(JSON.stringify(context), 600),
      ua: clip(typeof navigator !== 'undefined' ? navigator.userAgent : '', 300),
      at: serverTimestamp(),
    }).catch(() => {});
  } catch { /* 보고 실패는 무시 */ }
}
