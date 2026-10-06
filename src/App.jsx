import { useMediaQuery } from '@/hooks/useMediaQuery';
import AIAvailabilityProvider from '@/components/ui/AIAvailabilityProvider';
import VisualViewportSupport from '@/components/ui/VisualViewportSupport';
import AuthenticationBoundary from '@/components/ui/AuthenticationBoundary';
import { onDisconnect, onValue, ref, remove, set } from 'firebase/database';
import { BrowserRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import EmptyState from '@/components/ui/EmptyState';
import CodeEntryPage from '@/app/routes/student/CodeEntryPage';
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
  return <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6">
    <EmptyState title="페이지를 찾을 수 없습니다" titleAs="h1" description="주소를 다시 확인해 주세요." mascotSize="lg" mood="thinking">
      <a href="/" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-900 dark:bg-slate-100 px-5 text-sm font-semibold text-white dark:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">홈으로 돌아가기</a>
    </EmptyState>
  </div>;
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

  if (!sessionId) return <CodeEntryPage />;

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
      <AIAvailabilityProvider>
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
      </AIAvailabilityProvider>
      </AuthenticationBoundary>
    </BrowserRouter>
    </MotionConfig>
  );
}

export default App;
