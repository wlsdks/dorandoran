import { onDisconnect, onValue, ref, set, update, serverTimestamp } from 'firebase/database';
import { BrowserRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import JoinPage from '@/app/routes/student/JoinPage';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { SuspenseFallback } from '@/components/ui/Skeleton';
import { db } from '@/lib/firebase';
import { getNickname, getParticipantId, hasJoinedSession, markSessionJoined, getSessionNickname, getSessionEmployeeId } from '@/lib/participant';
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

    const nickname = (getSessionNickname(sessionId) || getNickname()).trim();
    if (!nickname) return;
    const employeeId = getSessionEmployeeId(sessionId).trim();

    const participantId = getParticipantId();
    const participantRef = ref(db, `sessions/${sessionId}/participants/${participantId}`);
    const onlineRef = ref(db, `sessions/${sessionId}/participants/${participantId}/online`);

    // 최초 1회만 참여자 메타 기록 — joinedAt은 여기서만 찍고 재접속마다 갱신하지 않음.
    // (JoinPage가 아닌 App.jsx 한 곳에서 presence를 일원화 — 중복 write 제거)
    set(participantRef, {
      nickname,
      joinedAt: serverTimestamp(),
      online: true,
      ...(employeeId ? { employeeId } : {}), // 사번(선택) — 입력했을 때만 기록
    }).catch((err) => logger.warn('[presence] init failed', err));

    // 재접속(.info/connected) 시: online만 갱신(이미 true면 무변경 → 리스너 미발화) + onDisconnect 재무장.
    // 전체 노드 set/joinedAt 재기록을 하지 않아, 교실 Wi-Fi 블립에 300명이 동시에 full-node write를
    // 쏟아내 강사·전자칠판이 프리징되던 fan-out 폭주를 방지한다. joinedAt churn(리포트 참여시간 왜곡)도 제거.
    const connRef = ref(db, '.info/connected');
    const unsub = onValue(connRef, (snap) => {
      if (snap.val() !== true) return;
      update(participantRef, { online: true }).catch((err) => logger.warn('[presence] reconnect failed', err));
      onDisconnect(onlineRef).set(false).catch((err) => logger.warn('[presence] onDisconnect failed', err));
    });

    // cleanup: 리스너 해제 + 이전 세션의 onDisconnect 무장 해제(세션 전환 시 잔존 방지)
    return () => {
      unsub();
      onDisconnect(onlineRef).cancel().catch(() => { /* 이미 해제됨 무시 */ });
    };
  }, [joined, sessionId]);

  if (!sessionId) {
    return (
      <div className="relative min-h-dvh bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
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

  return (
    <MotionConfig reducedMotion="user">
    <BrowserRouter>
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
    </BrowserRouter>
    </MotionConfig>
  );
}

export default App;
