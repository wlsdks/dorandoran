import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ref, set } from 'firebase/database';
import { db } from '@/lib/firebase';
import { auth, ensureAuthentication, onAuthStateChanged, restoreStaffProfile } from '@/lib/auth-session';
import { SuspenseFallback } from './Skeleton';
import Button from './Button';

/** 인증 복원 전에는 데이터 화면을 마운트하지 않는다. 랜딩과 로그인은 바로 접근할 수 있다. */
export default function AuthenticationBoundary({ children }) {
  const location = useLocation();
  const sessionId = new URLSearchParams(location.search).get('s');
  const needsGuest = location.pathname !== '/admin' && (location.pathname !== '/' || Boolean(sessionId));
  const viewer = location.pathname === '/live' ? sessionId : null;
  const [state, setState] = useState({ ready: false, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let epoch = 0;
    setState({ ready: false, error: null });
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const current = ++epoch;
      try {
        if (!active) return;
        if (!user && needsGuest) { await ensureAuthentication(); return; }
        await restoreStaffProfile(user);
        if (!active || current !== epoch || auth.currentUser?.uid !== user?.uid) return;
        if (user && viewer) await set(ref(db, `sessionViewers/${viewer}/${user.uid}`), true);
        if (active) setState({ ready: true, error: null });
      } catch (error) { if (active && current === epoch) setState({ ready: false, error }); }
    });
    return () => { active = false; unsubscribe(); };
  }, [needsGuest, viewer, attempt]);
  if (state.error) return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center bg-slate-50 dark:bg-slate-900">
      <p role="alert" className="text-sm text-slate-600 dark:text-slate-300">{state.error.code === 'auth/too-many-requests' ? '입장 요청이 잠시 몰렸어요. 잠시 후 다시 시도해주세요.' : '연결을 확인한 뒤 다시 시도해주세요'}</p>
      <Button onClick={() => setAttempt((value) => value + 1)}>다시 시도</Button>
    </div>
  );
  return state.ready ? children : <SuspenseFallback />;
}
