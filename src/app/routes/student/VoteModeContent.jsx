import { lazy, Suspense } from 'react';
import { SuspenseFallback } from '@/components/ui/Skeleton';
import StudentHeader from './StudentHeader';
import StudentBottomBar from './StudentBottomBar';
import WaitingPage from './WaitingPage';
import ActivePollView from './ActivePollView';
import StudentResultCard from './StudentResultCard';

const LazyLeaderboardPage = lazy(() => import('./LeaderboardPage'));
const LazySessionEndedPage = lazy(() => import('./SessionEndedPage'));
const LazyClassQABoard = lazy(() => import('@/features/class-questions/components/ClassQABoard'));
const LazyFocusOverlay = lazy(() => import('@/features/session/components/FocusOverlay'));
const LazyComprehensionCheck = lazy(() => import('@/features/session/components/ComprehensionCheck'));
const LazyQuickSurvey = lazy(() => import('@/features/session/components/QuickSurvey'));
const LazyGroupDiscussion = lazy(() => import('@/features/session/components/GroupDiscussion'));
const LazyQARanking = lazy(() => import('@/features/class-questions/components/QARanking'));
const LazyJoinShow = lazy(() => import('@/features/games/components/JoinShow'));

/**
 * Dispatches to the correct view for the current session mode.
 * Lazy-loads heavy pages so the initial bundle stays small.
 */
export function VoteModeContent({
  sessionId, session, status, currentMode, currentQId,
  questionProgress, timerRunning, endTime, duration,
  timerExpired, onTimerExpire,
  isSpeedQuiz, speedQuizIndex, speedQuizTotal, myStreak, myScore,
}) {
  if (status === 'ended') {
    return (
      <Suspense fallback={<SuspenseFallback />}>
        <LazySessionEndedPage sessionId={sessionId} session={session} />
      </Suspense>
    );
  }
  if (status === 'reviewing') {
    return (
      <Suspense fallback={<SuspenseFallback />}>
        <LazySessionEndedPage sessionId={sessionId} session={session} reviewing />
      </Suspense>
    );
  }
  if (currentMode === 'leaderboard') {
    return (
      <Suspense fallback={<SuspenseFallback />}>
        <LazyLeaderboardPage sessionId={sessionId} highlight={session?.leaderboardHighlight} />
      </Suspense>
    );
  }
  if (currentMode === 'combinedRanking') {
    // 학생 단말은 votes가 본인 것만이라 전체 순위 계산 불가 → 본인 결과만 보여주고 전자칠판 안내.
    return (
      <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 px-4 pt-[calc(5rem+env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <StudentHeader sessionId={sessionId} />
        <StudentResultCard session={session} />
        <StudentBottomBar sessionId={sessionId} />
      </div>
    );
  }
  if (currentMode === 'focus') {
    return (
      <Suspense fallback={<SuspenseFallback />}>
        <LazyFocusOverlay sessionId={sessionId} />
      </Suspense>
    );
  }
  if (currentMode === 'comprehension') {
    return (
      <div className="student-mode-page min-h-dvh bg-slate-50 dark:bg-slate-900 pt-[calc(5.5rem+env(safe-area-inset-top))] pb-[calc(7rem+env(safe-area-inset-bottom))] px-4">
        <StudentHeader sessionId={sessionId} />
        <Suspense fallback={<SuspenseFallback />}><LazyComprehensionCheck sessionId={sessionId} embedded /></Suspense>
        <StudentBottomBar sessionId={sessionId} />
      </div>
    );
  }
  if (currentMode === 'quickSurvey') {
    return (
      <div className="student-mode-page min-h-dvh bg-slate-50 dark:bg-slate-900 pt-[calc(5.5rem+env(safe-area-inset-top))] pb-[calc(7rem+env(safe-area-inset-bottom))] px-4">
        <StudentHeader sessionId={sessionId} />
        <Suspense fallback={<SuspenseFallback />}><LazyQuickSurvey sessionId={sessionId} embedded /></Suspense>
        <StudentBottomBar sessionId={sessionId} />
      </div>
    );
  }
  if (currentMode === 'discussion') {
    return (
      <div className="student-mode-page min-h-dvh bg-slate-50 dark:bg-slate-900 pt-[calc(5.5rem+env(safe-area-inset-top))] pb-[calc(7rem+env(safe-area-inset-bottom))] px-4">
        <StudentHeader sessionId={sessionId} />
        <Suspense fallback={<SuspenseFallback />}><LazyGroupDiscussion sessionId={sessionId} embedded /></Suspense>
        <StudentBottomBar sessionId={sessionId} />
      </div>
    );
  }
  if (currentMode === 'qaBoard') {
    return (
      <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[calc(5rem+env(safe-area-inset-top))]">
        <StudentHeader sessionId={sessionId} />
        <Suspense fallback={<SuspenseFallback />}>
          <LazyClassQABoard sessionId={sessionId} showInput />
        </Suspense>
        <StudentBottomBar sessionId={sessionId} />
      </div>
    );
  }
  if (currentMode === 'qaRanking') {
    return (
      <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 px-4 pt-[calc(5rem+env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <StudentHeader sessionId={sessionId} />
        <Suspense fallback={<SuspenseFallback />}>
          <LazyQARanking sessionId={sessionId} />
        </Suspense>
        <StudentBottomBar sessionId={sessionId} />
      </div>
    );
  }
  if (currentMode === 'joinShow') {
    // 학생 화면은 큰 카운터 대신 친절한 대기 안내 — joinShow는 전자칠판 전용 시각화고
    // 학생 입장에선 "들어왔다는 걸 확인 중"임을 알면 충분 (WaitingPage의 GAME_MODES.joinShow 라벨로).
    return (
      <WaitingPage
        sessionId={sessionId}
        courseName={session?.courseName}
        currentMode="joinShow"
      />
    );
  }

  const question = session?.questions?.[currentQId];
  const persistentAssignmentId = session?.persistentAssignmentId || null;
  const persistentQ = persistentAssignmentId ? session?.questions?.[persistentAssignmentId] : null;
  // 상시 과제는 aiJudge 타입이고, 현재 활성 질문과 다를 때만 별도 노출
  const showPersistent = !!persistentQ && persistentQ.type === 'aiJudge' && persistentAssignmentId !== currentQId;

  if (!['poll', 'quiz'].includes(currentMode) || !currentQId || !question) {
    return (
      <WaitingPage
        sessionId={sessionId}
        pendingEvent={session?.pendingEvent || null}
        courseName={session?.courseName}
        currentMode={currentMode}
        persistentAssignmentId={showPersistent ? persistentAssignmentId : null}
        persistentAssignmentTitle={persistentQ?.title}
      />
    );
  }

  return (
    <ActivePollView
      sessionId={sessionId}
      question={question}
      questionId={currentQId}
      questionProgress={questionProgress}
      timerRunning={timerRunning}
      endTime={endTime}
      duration={duration}
      timerExpired={timerExpired}
      onTimerExpire={onTimerExpire}
      isSpeedQuiz={isSpeedQuiz}
      speedQuizIndex={speedQuizIndex}
      speedQuizTotal={speedQuizTotal}
      myStreak={myStreak}
      myScore={myScore}
      persistentAssignmentId={showPersistent ? persistentAssignmentId : null}
      persistentAssignmentTitle={persistentQ?.title}
    />
  );
}
