import { useMediaQuery } from '@/hooks/useMediaQuery';
import { motion as motionTokens } from '@/lib/design-tokens';
import VisualViewportSupport from '@/components/ui/VisualViewportSupport';
import AuthenticationBoundary from '@/components/ui/AuthenticationBoundary';
import { onDisconnect, onValue, ref, remove, set } from 'firebase/database';
import { BrowserRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import JoinPage from '@/app/routes/student/JoinPage';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { SuspenseFallback } from '@/components/ui/Skeleton';
import { db } from '@/lib/firebase';
import { getParticipantId, hasJoinedSession, markSessionJoined } from '@/lib/participant';
import { logger } from '@/lib/logger';
import { useTheme } from '@/hooks/useTheme';

const VotePage = lazy(() => import('@/app/routes/student/VotePage'));
const AdminPage = lazy(() => import('@/app/routes/admin/AdminPage'));
const LivePage = lazy(() => import('@/app/routes/live/LivePage'));
const ReportPage = lazy(() => import('@/app/routes/report/ReportPage'));
const SubmitPage = lazy(() => import('@/app/routes/submit/SubmitPage'));

function NotFoundPage() {
  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="text-center space-y-5 max-w-xs"
      >
        <DoranDoranMascot size="lg" mood="thinking" className="mx-auto" />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">페이지를 찾을 수 없습니다</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
            주소를 다시 확인해주세요
          </p>
        </div>
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          홈으로 돌아가기
        </a>
      </motion.div>
    </div>
  );
}

function StudentRouter() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('s');
  const [joined, setJoined] = useState(() => hasJoinedSession(sessionId));

  useEffect(() => {
    setJoined(hasJoinedSession(sessionId));
  }, [sessionId]);

  // Listen for nickname change requests from StudentHeader
  useEffect(() => {
    const handler = () => setJoined(false);
    window.addEventListener('dorandoran:change-nickname', handler);
    return () => window.removeEventListener('dorandoran:change-nickname', handler);
  }, []);

  useEffect(() => {
    if (!joined || !sessionId) return;


    const participantId = getParticipantId();
    const connectionRef = ref(db, `sessions/${sessionId}/participants/${participantId}/connections/${crypto.randomUUID()}`);
    let active = true;
    const disconnect = onDisconnect(connectionRef);
    const unsub = onValue(ref(db, '.info/connected'), async (snapshot) => {
      if (!snapshot.val() || !active) return;
      try {
        // 서버가 끊김 처리를 접수한 뒤 연결을 표시한다. 늦게 완료된 등록도 해제한다.
        await disconnect.remove();
        if (!active) { await disconnect.cancel(); return; }
        await refConnection();
      } catch (error) { logger.warn('접속 상태 갱신 실패', error?.code); }
    });
    async function refConnection() {
      if (active) await set(connectionRef, true);
      if (!active) await remove(connectionRef).catch(() => {});
    }
    return () => {
      active = false; unsub();
      disconnect.cancel().catch(() => {});
      remove(connectionRef).catch(() => {});
    };
  }, [joined, sessionId]);

  if (!sessionId) {
    return (
      <div className="relative min-h-dvh bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: motionTokens.duration.normal }}
          className="text-center space-y-5 max-w-xs"
        >
          <div className="flex justify-center">
            <DoranDoranMascot size="lg" mood="waiting" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">도란도란</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
              강사가 공유한 링크 또는 QR코드를<br />통해 접속해주세요
            </p>
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="text-xs text-slate-400 dark:text-slate-500">실시간 강의 참여 플랫폼</span>
          </div>
        </motion.div>
        <a
          href="/admin"
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors underline underline-offset-2"
        >
          강사이신가요? 로그인
        </a>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {!joined ? (
        <motion.div
          key="join"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        >
          <JoinPage
            sessionId={sessionId}
            onJoin={(participantId, nickname, employeeId) => {
              markSessionJoined(sessionId, participantId, nickname, employeeId);
              setJoined(true);
            }}
          />
        </motion.div>
      ) : (
        <motion.div
          key="vote"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        >
          <Suspense fallback={<SuspenseFallback />}>
            <VotePage key={sessionId} sessionId={sessionId} />
          </Suspense>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function App() {
  // Apply theme at app root so it's always active (not just on MoreView mount)
  useTheme();
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  return (
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'never'}>
    <BrowserRouter>
      <VisualViewportSupport />
      <AuthenticationBoundary>
      <Routes>
        <Route path="/" element={
          <ErrorBoundary scope="student">
            <StudentRouter />
          </ErrorBoundary>
        } />
        <Route path="/admin" element={
          <ErrorBoundary scope="admin">
            <Suspense fallback={<SuspenseFallback />}>
              <AdminPage />
            </Suspense>
          </ErrorBoundary>
        } />
        <Route path="/live" element={
          <ErrorBoundary scope="live">
            <Suspense fallback={<SuspenseFallback />}>
              <LivePage />
            </Suspense>
          </ErrorBoundary>
        } />
        <Route path="/report" element={
          <ErrorBoundary scope="report">
            <Suspense fallback={<SuspenseFallback />}>
              <ReportPage />
            </Suspense>
          </ErrorBoundary>
        } />
        <Route path="/submit" element={
          <ErrorBoundary scope="submit">
            <Suspense fallback={<SuspenseFallback />}>
              <SubmitPage />
            </Suspense>
          </ErrorBoundary>
        } />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </AuthenticationBoundary>
    </BrowserRouter>
    </MotionConfig>
  );
}

export default App;
