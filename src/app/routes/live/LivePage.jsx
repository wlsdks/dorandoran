import ParticipationSpotlight from '@/components/ui/ParticipationSpotlight';
import { lazy, Suspense, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from '@/features/session/api/useSession';
import { isSpecialMode } from '@/lib/modes';
import { useParticipants } from '@/features/participants/api/useParticipants';
import { useTimer } from '@/features/timer/api/useTimer';
import { useVotes } from '@/hooks/useVotes';
import { useScores } from '@/features/quiz/api/useScores';
import { useHandRaises } from '@/features/hand-raise/api/useHandRaises';
import { useUrgentQuestions } from '@/features/questions/api/useUrgentQuestions';
import VizRenderer from '@/features/visualization/components/VizRenderer';
import ReactionOverlay from '@/features/reactions/components/ReactionOverlay';
import ChatBubbleOverlay from '@/features/reactions/components/ChatBubbleOverlay';
import AnswerBubbleOverlay from '@/features/voting/components/AnswerBubbleOverlay';
import JoinToast from '@/features/participants/components/JoinToast';
import TimerCountdown from '@/features/timer/components/TimerCountdown';
import Badge from '@/components/ui/Badge';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';

import ConnectionBanner from '@/components/ui/ConnectionBanner';
import EventStats from '@/features/participants/components/EventStats';
import LiveHeader from './LiveHeader';
import DrumrollOverlay from '@/components/ui/DrumrollOverlay';
import LiveParticipation from './LiveParticipation';

const Lottery = lazy(() => import('@/features/games/components/Lottery'));
const ScratchCard = lazy(() => import('@/features/games/components/ScratchCard'));
const BreakTimer = lazy(() => import('@/features/games/components/BreakTimer'));
const Leaderboard = lazy(() => import('@/features/quiz/components/Leaderboard'));
const ClassQABoard = lazy(() => import('@/features/class-questions/components/ClassQABoard'));
const QARanking = lazy(() => import('@/features/class-questions/components/QARanking'));
const JoinShow = lazy(() => import('@/features/games/components/JoinShow'));
const AwardsCeremony = lazy(() => import('@/features/assignments/components/AwardsCeremony'));
const RandomPicker = lazy(() => import('@/features/games/components/RandomPicker'));
const ComprehensionPresenter = lazy(() => import('@/features/session/components/ComprehensionCheck').then(m => ({ default: m.ComprehensionPresenter })));
const SurveyPresenter = lazy(() => import('@/features/session/components/QuickSurvey').then(m => ({ default: m.SurveyPresenter })));
const DiscussionPresenter = lazy(() => import('@/features/session/components/DiscussionPresenter'));
const CombinedRanking = lazy(() => import('@/features/quiz/components/CombinedRanking'));

const GameFallback = () => (
  <div className="flex items-center justify-center min-h-[300px]">
    <div className="flex items-center gap-2 text-slate-400">
      <div className="w-5 h-5 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin" />
      <span className="text-sm">준비 중...</span>
    </div>
  </div>
);

export default function LivePage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('s');
  const { session, loading } = useSession(sessionId);
  const { onlineList, count } = useParticipants(sessionId);
  const { isRunning, endTime, duration } = useTimer(sessionId);
  const { scores, leaderboard } = useScores(sessionId);
  const { count: handCount } = useHandRaises(sessionId);
  const { unreadCount: urgentCount } = useUrgentQuestions(sessionId);

  const currentQId = session?.currentQuestion;
  const currentMode = session?.currentMode;
  const question = currentQId ? session?.questions?.[currentQId] : null;
  const { totalVotes } = useVotes(sessionId, currentQId);

  // drawParticipants: onlineList enriched with ticket data for weighted lottery.
  // 추첨 모드에서만 계산 — 그 외엔 scores 변경마다 300명 재계산하던 비용 제거.
  const drawParticipants = useMemo(
    () => currentMode === 'lottery' || currentMode === 'scratchCard'
      ? onlineList.map((p) => ({ ...p, ...scores[p.id], tickets: scores[p.id]?.tickets || 0 }))
      : [],
    [onlineList, scores, currentMode]
  );

  // 결과 발행은 하지 않는다 — 전자칠판은 보기 전용이고, 당첨자 기록은 강사 화면 한 곳에서만
  // 발행한다(두 화면이 각자 발행하면 학생 폰에 서로 다른 당첨자가 뜬다).

  // Stable per-game callbacks (avoid re-creating on every render)
  const isGameMode = isSpecialMode(currentMode);
  const isEnded = session?.status === 'ended';
  const hasActiveQuestion = ['poll', 'quiz'].includes(currentMode) && currentQId && question;


  if (!sessionId) {
    return (
      <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="flex flex-col items-center text-center space-y-4">
          <DoranDoranMascot size="lg" mood="thinking" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">세션 ID가 없습니다</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center gap-4">
        <DoranDoranMascot size="md" mood="thinking" />
        <p className="text-sm text-slate-400">불러오는 중...</p>
      </div>
    );
  }

  // Session ended
  if (isEnded) {
    return (
      <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="text-center space-y-5"
        >
          <DoranDoranMascot size="lg" mood="happy" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">수업이 종료되었습니다</h1>
          <p className="text-slate-400 text-sm">참여해 주셔서 감사합니다</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="dark classroom-stage h-dvh bg-slate-900 flex flex-col overflow-hidden">
      <LiveHeader courseName={session?.courseName} roundNumber={session?.roundNumber} count={count}
        handCount={handCount} urgentCount={urgentCount}
        sessionId={sessionId} startedAt={session?.startedAt} status={session?.status} />
      <ConnectionBanner />
      <ParticipationSpotlight sessionId={sessionId} />
      <JoinToast sessionId={sessionId} />
      <ReactionOverlay sessionId={sessionId} />
      <ChatBubbleOverlay sessionId={sessionId} />
      <DrumrollOverlay active={!!session?.drumroll} />
      <AnswerBubbleOverlay
        sessionId={sessionId}
        questionId={session?.currentQuestion}
      />

      {/* 정렬: items-start + 자식 my-auto = 콘텐츠가 뷰포트보다 짧으면 정중앙(프로젝터 여백낭비 방지),
          넘치면(aiJudge 그리드 등) 상단부터 스크롤되어 상단 잘림도 방지 — 두 요구를 동시 충족.
          폭은 QHD(2560) 프로젝터에서 작게 떠 보이지 않도록 2xl 이상에서 확장. */}
      <div className="flex-1 flex justify-center items-start overflow-y-auto px-8 pt-4 pb-10">
        <div className={`w-full mx-auto my-auto ${question?.type === 'imageSlide' ? 'max-w-none' : 'max-w-[1600px]'}`} >
          <AnimatePresence mode="wait">
            {isGameMode ? (
              <motion.div
                key={`game-${currentMode}`}
                initial={currentMode === 'leaderboard' ? { opacity: 0, y: -12 } : { opacity: 0, scale: 0.98 }}
                animate={currentMode === 'leaderboard' ? { opacity: 1, y: 0 } : { opacity: 1, scale: 1 }}
                exit={currentMode === 'leaderboard' ? { opacity: 0, y: 30 } : { opacity: 0, scale: 1.06 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="w-full"
              >
                <Suspense fallback={<GameFallback />}>
                  {currentMode === 'lottery' && (
                    <Lottery participants={drawParticipants} presenter sessionId={sessionId} role="view" />
                  )}
                  {/* 전자칠판은 조작하지 않는다 — 강사 화면의 판을 그대로 비추는 보기 전용 */}
                  {currentMode === 'scratchCard' && (
                    <ScratchCard sessionId={sessionId} role="view" presenter />
                  )}
                  {currentMode === 'breakTime' && <BreakTimer sessionId={sessionId} />}
                  {currentMode === 'leaderboard' && <div className="w-full max-w-2xl mx-auto [&_.max-w-xl]:max-w-none"><Leaderboard entries={leaderboard} maxShow={10} title="실시간 리더보드" /></div>}
                  {currentMode === 'qaBoard' && <div className="w-full max-w-4xl mx-auto"><ClassQABoard sessionId={sessionId} showInput={false} isAdmin role="admin" /></div>}
                  {currentMode === 'qaRanking' && <QARanking sessionId={sessionId} />}
                  {currentMode === 'joinShow' && <JoinShow sessionId={sessionId} />}
                  {currentMode === 'awards' && <AwardsCeremony assignmentId={session?.activeAssignmentId} readOnly />}
                  {currentMode === 'randomPicker' && <RandomPicker participants={onlineList} sessionId={sessionId} role="view" />}
                  {currentMode === 'comprehension' && <ComprehensionPresenter sessionId={sessionId} />}
                  {currentMode === 'quickSurvey' && <SurveyPresenter sessionId={sessionId} />}
                  {currentMode === 'discussion' && <DiscussionPresenter sessionId={sessionId} />}
                  {currentMode === 'combinedRanking' && <CombinedRanking session={session} />}
                  {currentMode === 'focus' && (
                    <div className="flex flex-col items-center justify-center gap-6 text-center">
                      <DoranDoranMascot size="lg" mood="focus" />
                      <p className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">집중 모드</p>
                      <p className="text-slate-400 dark:text-white/40 text-lg">학생 화면이 잠겼습니다</p>
                    </div>
                  )}
                </Suspense>
              </motion.div>
            ) : hasActiveQuestion ? (
              <motion.div
                key={`question-${currentQId}`}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="w-full space-y-6"
              >
                {isRunning && endTime && (
                  <div className="max-w-xl mx-auto">
                    <TimerCountdown endTime={endTime} duration={duration} />
                  </div>
                )}

                <div className="w-full [&_.max-w-xl]:max-w-none">
                  <VizRenderer sessionId={sessionId} session={session} isPresenter />
                </div>

                {question?.type !== 'imageSlide' && <LiveParticipation voted={totalVotes} total={count} />}
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="flex flex-col items-center text-center space-y-5">
                <motion.div animate={{ scale: [1, 1.03, 1] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
                  <DoranDoranMascot size="lg" mood="waiting" />
                </motion.div>
                <h2 className="text-xl font-semibold text-slate-500 dark:text-slate-300 tracking-tight">
                  다음 질문을 기다리는 중...
                </h2>
                {session?.requireEmployeeId ? (
                  <EventStats participants={onlineList} count={count} variant="presenter" />
                ) : (
                  <Badge variant="neutral">
                    {count}명 접속 중
                  </Badge>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
