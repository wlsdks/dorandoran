import ParticipationSpotlight from '@/components/ui/ParticipationSpotlight';
import { lazy, Suspense, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
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
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';

import ConnectionBanner from '@/components/ui/ConnectionBanner';
import EventStats from '@/features/participants/components/EventStats';
import LiveHeader from './LiveHeader';
import DrumrollOverlay from '@/components/ui/DrumrollOverlay';
import LiveParticipation from './LiveParticipation';
import QuizTallyNotice from './QuizTallyNotice';

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
  const reducedMotion = useReducedMotion();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('s');
  const { session, loading } = useSession(sessionId, { readOnly: true });
  const { list: participantList, onlineList, count } = useParticipants(sessionId);
  const { isRunning, endTime, duration } = useTimer(sessionId);
  const { leaderboard } = useScores(['leaderboard','combinedRanking'].includes(session?.currentMode) ? sessionId : null);
  const { count: handCount } = useHandRaises(sessionId);
  const { unreadCount: urgentCount } = useUrgentQuestions(sessionId);

  const currentQId = session?.currentQuestion;
  const currentMode = session?.currentMode;
  const question = currentQId ? session?.questions?.[currentQId] : null;
  const { totalVotes, resultsHidden, loading: votesLoading } = useVotes(sessionId, currentQId);
  const audienceResultsHidden = resultsHidden;

  // 추첨 대상은 현재 참여자이며 모두 같은 확률로 선택한다.
  // 추첨 모드에서만 계산 — 그 외엔 scores 변경마다 300명 재계산하던 비용 제거.
  const drawParticipants = useMemo(
    () => currentMode === 'lottery' || currentMode === 'scratchCard'
      ? onlineList
      : [],
    [onlineList, currentMode]
  );

  // 결과 발행은 하지 않는다 — 전자칠판은 보기 전용이고, 당첨자 기록은 강사 화면 한 곳에서만
  // 발행한다(두 화면이 각자 발행하면 학생 폰에 서로 다른 당첨자가 뜬다).

  // Stable per-game callbacks (avoid re-creating on every render)
  const isGameMode = isSpecialMode(currentMode);
  // 종료 직후에는 'reviewing'(후속 질문 받는 기간)이 된다 — 전자칠판에는 둘 다 끝난 수업으로 보여준다.
  const isEnded = session?.status === 'ended' || session?.status === 'reviewing';
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

  // Session ended — 전자칠판은 큰 화면이라 어두운 무대에 짧은 요약만 남긴다
  if (isEnded) {
    const questionCount = Object.keys(session?.questions || {}).length;
    return (
      <div className="dark classroom-stage min-h-dvh bg-slate-950 flex items-center justify-center px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="text-center space-y-6"
        >
          <div className="flex justify-center"><DoranDoranMascot size="lg" mood="happy" /></div>
          <h1 className="classroom-question-title font-bold text-slate-50 tracking-tight">수업이 끝났어요</h1>
          <p className="text-xl lg:text-2xl text-slate-400">참여해 주셔서 감사합니다</p>
          <dl className="flex items-center justify-center gap-10 pt-2 text-slate-300">
            <div><dt className="text-base text-slate-400">함께한 학생</dt><dd className="text-3xl lg:text-4xl font-bold tabular-nums text-slate-50">{participantList.length}명</dd></div>
            {questionCount > 0 && <div><dt className="text-base text-slate-400">진행한 활동</dt><dd className="text-3xl lg:text-4xl font-bold tabular-nums text-slate-50">{questionCount}개</dd></div>}
          </dl>
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
      {currentMode !== 'joinShow' && <JoinToast sessionId={sessionId} />}
      <ReactionOverlay sessionId={sessionId} />
      <ChatBubbleOverlay sessionId={sessionId} />
      {/* 학생이 답하면 전자칠판에도 버블이 떠오른다 — 답 내용은 숨긴다 */}
      <AnswerBubbleOverlay sessionId={sessionId} questionId={currentQId} hideText />
      <DrumrollOverlay active={!!session?.drumroll} />


      {/* 정렬: items-start + 자식 my-auto = 콘텐츠가 뷰포트보다 짧으면 정중앙(프로젝터 여백낭비 방지),
          넘치면(aiJudge 그리드 등) 상단부터 스크롤되어 상단 잘림도 방지 — 두 요구를 동시 충족.
          폭은 QHD(2560) 프로젝터에서 작게 떠 보이지 않도록 2xl 이상에서 확장. */}
      <div className="flex-1 flex justify-center items-start overflow-y-auto px-8 pt-4 pb-10">
        <div className={`w-full mx-auto my-auto ${question?.type === 'imageSlide' ? 'max-w-none' : currentMode === 'joinShow' ? 'max-w-[2200px]' : 'max-w-[1800px]'}`} >
          <AnimatePresence mode="wait">
            {isGameMode ? (
              <motion.div
                key={`game-${currentMode}`}
                initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reducedMotion ? 0.08 : 0.18, ease: 'easeOut' }}
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
                  {currentMode === 'breakTime' && <BreakTimer sessionId={sessionId} presenter readOnly />}
                  {currentMode === 'leaderboard' && <div className="w-full"><Leaderboard presenter entries={leaderboard} maxShow={10} page={session?.leaderboardPage || 0} highlight={session?.leaderboardHighlight} title="실시간 리더보드" /></div>}
                  {currentMode === 'qaBoard' && <div className="w-full max-w-4xl mx-auto" style={{ maxWidth: 1100 }}><ClassQABoard presenter readOnly sessionId={sessionId} showInput={false} role="viewer" /></div>}
                  {currentMode === 'qaRanking' && <QARanking sessionId={sessionId} presenter readOnly />}
                  {currentMode === 'joinShow' && <JoinShow sessionId={sessionId} eventMode={Boolean(session?.requireEmployeeId)} />}
                  {currentMode === 'awards' && <AwardsCeremony presenter sessionId={sessionId} assignmentId={session?.activeAssignmentId} readOnly />}
                  {currentMode === 'randomPicker' && <RandomPicker participants={onlineList} sessionId={sessionId} role="view" presenter />}
                  {currentMode === 'comprehension' && <ComprehensionPresenter sessionId={sessionId} presenter readOnly />}
                  {currentMode === 'quickSurvey' && <SurveyPresenter sessionId={sessionId} presenter readOnly />}
                  {currentMode === 'discussion' && <DiscussionPresenter sessionId={sessionId} presenter readOnly />}
                  {currentMode === 'combinedRanking' && <CombinedRanking sessionId={sessionId} session={session} />}
                  {currentMode === 'focus' && (
                    <div className="flex flex-col items-center justify-center gap-6 text-center">
                      <DoranDoranMascot size="lg" mood="focus" />
                      <p className="classroom-question-title font-bold text-slate-900 dark:text-white tracking-tight">집중 모드</p>
                      <p className="classroom-option-label text-slate-400 dark:text-slate-400">학생 화면이 잠겼습니다</p>
                    </div>
                  )}
                </Suspense>
              </motion.div>
            ) : hasActiveQuestion ? (
              <motion.div
                key={`question-${currentQId}`}
                initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reducedMotion ? 0.08 : 0.18, ease: 'easeOut' }}
                className="w-full space-y-6"
              >
                {isRunning && endTime && (
                  <div className="mx-auto w-[min(84vw,1800px)] max-w-3xl">
                    <TimerCountdown endTime={endTime} duration={duration} presenter />
                  </div>
                )}

                <div className="w-full [&_.max-w-xl]:max-w-none">
                  <VizRenderer sessionId={sessionId} session={session} isPresenter />
                </div>

                {question?.type === 'quiz' && !question?.revealedAt && <QuizTallyNotice sessionId={sessionId} questionId={currentQId} activatedAt={question?.activatedAt || 0} />}
                {question?.type !== 'imageSlide' && <LiveParticipation voted={totalVotes} total={count} resultsHidden={audienceResultsHidden} loading={votesLoading} />}
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="flex flex-col items-center text-center space-y-5">
                <motion.div animate={reducedMotion ? {} : { scale: [1, 1.03, 1] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
                  <DoranDoranMascot size="lg" mood="waiting" animated={!reducedMotion} />
                </motion.div>
                <h2 className="classroom-option-label font-semibold text-slate-500 dark:text-slate-300 tracking-tight">
                  다음 질문을 기다리는 중...
                </h2>
                {session?.requireEmployeeId ? (
                  <EventStats participants={onlineList} count={count} variant="presenter" />
                ) : (
                  <p className="text-[clamp(16px,1.1vw,26px)] tabular-nums text-slate-400 dark:text-slate-400">
                    <span className="font-semibold text-slate-200">{count}명</span> 접속 중
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
