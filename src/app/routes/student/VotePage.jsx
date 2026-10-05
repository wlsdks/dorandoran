import { useState, useCallback, useEffect, useRef, useMemo, memo } from 'react';
import { useSession } from '@/features/session/api/useSession';
import { motion, AnimatePresence } from 'framer-motion';
import { VotePageSkeleton, SuspenseFallback } from '@/components/ui/Skeleton';
import { useTimer } from '@/features/timer/api/useTimer';
import { useMyScore } from '@/features/quiz/api/useScores';
import { useAchievements } from '@/features/quiz/api/useAchievements';
import { useSpeedQuizStudent } from '@/features/quiz/api/useSpeedQuizStudent';
import AchievementToast from '@/features/quiz/components/AchievementToast';
import { getParticipantId } from '@/lib/participant';
import StudentHeader from './StudentHeader';
import WaitingPage from './WaitingPage';
import ActivePollView from './ActivePollView';
import { getModeVariants, ENTER_TRANSITION } from './VoteHelpers';
import { VoteModeContent } from './VoteModeContent';
import DrumrollOverlay from '@/components/ui/DrumrollOverlay';
import ChatBubbleOverlay from '@/features/reactions/components/ChatBubbleOverlay';

export default memo(function VotePage({ sessionId }) {
  // 본인 participantId 전달 → useSession이 타인 votes를 버려, 다른 학생 투표마다
  // 전 학생 단말이 리렌더되던 fan-out 차단(본인 투표 시에만 리렌더).
  const myPid = getParticipantId();
  const { session, loading } = useSession(sessionId, { participantId: myPid });
  const { isRunning: timerRunning, endTime, duration } = useTimer(sessionId);
  const [timerExpired, setTimerExpired] = useState(false);


  const handleTimerExpire = useCallback(() => setTimerExpired(true), []);

  const prevQuestionRef = useRef(session?.currentQuestion);
  const prevEndTimeRef = useRef(endTime);
  useEffect(() => {
    const currentQId = session?.currentQuestion;
    if (currentQId !== prevQuestionRef.current || (endTime && endTime !== prevEndTimeRef.current)) {
      setTimerExpired(false);
    }
    prevQuestionRef.current = currentQId;
    prevEndTimeRef.current = endTime;
  }, [session?.currentQuestion, endTime]);

  const { myScore } = useMyScore(sessionId);
  const participantId = myPid;
  // useAchievements는 본인 점수(scores[pid])만 사용 → 본인 점수만 넘겨 전체 구독 회피
  const { achievements } = useAchievements(session, participantId ? { [participantId]: myScore } : {});
  const { isSpeedQuiz, totalQuestions: speedQuizTotal } = useSpeedQuizStudent(sessionId);
  const myStreak = myScore?.streak || 0;

  const speedQuizIndex = useMemo(() => {
    if (!isSpeedQuiz) return 0;
    const currentQId = session?.currentQuestion;
    const questions = session?.questions || {};
    const quizQs = Object.entries(questions)
      .filter(([, q]) => q.type === 'quiz')
      .sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
    const idx = currentQId ? quizQs.findIndex(([qId]) => qId === currentQId) : -1;
    return idx >= 0 ? idx + 1 : 0;
  }, [isSpeedQuiz, session?.currentQuestion, session?.questions]);

  const questionProgress = useMemo(() => {
    const currentQId = session?.currentQuestion;
    const questions = session?.questions || {};
    const sorted = Object.entries(questions).sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
    const total = sorted.length;
    if (total === 0 || !currentQId) return null;
    const idx = sorted.findIndex(([qId]) => qId === currentQId);
    return idx >= 0 ? { current: idx + 1, total } : null;
  }, [session?.questions, session?.currentQuestion]);

  if (loading) return <VotePageSkeleton />;

  const currentQId = session?.currentQuestion;
  const currentMode = session?.currentMode;
  const status = session?.status;

  // Determine AnimatePresence key & variants
  let modeKey;
  if (status === 'ended')                   modeKey = 'ended';
  else if (status === 'reviewing')          modeKey = 'reviewing';
  else if (currentMode === 'leaderboard')   modeKey = 'leaderboard';
  else if (currentMode === 'focus')         modeKey = 'focus';
  else if (currentMode === 'comprehension') modeKey = 'comprehension';
  else if (currentMode === 'quickSurvey')   modeKey = 'quickSurvey';
  else if (currentMode === 'discussion')    modeKey = 'discussion';
  else if (currentMode === 'qaBoard')       modeKey = 'qaBoard';
  else if (currentMode === 'qaRanking')    modeKey = 'qaRanking';
  else if (currentMode === 'joinShow')     modeKey = 'joinShow';
  else if (['poll', 'quiz'].includes(currentMode) && currentQId && session?.questions?.[currentQId])
    modeKey = `poll-${currentQId}`;
  else
    modeKey = `waiting-${currentMode || 'idle'}`;

  const variantKey = modeKey.startsWith('poll-') ? 'poll'
    : modeKey.startsWith('waiting-') ? 'waiting'
    : modeKey;
  const variants = getModeVariants(variantKey);

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={modeKey}
          initial={variants.initial}
          animate={variants.animate}
          exit={variants.exit}
          transition={ENTER_TRANSITION}
          style={{ willChange: 'transform, opacity' }}
        >
          <VoteModeContent
            sessionId={sessionId}
            session={session}
            status={status}
            currentMode={currentMode}
            currentQId={currentQId}
            questionProgress={questionProgress}
            timerRunning={timerRunning}
            endTime={endTime}
            duration={duration}
            timerExpired={timerExpired}
            onTimerExpire={handleTimerExpire}
            isSpeedQuiz={isSpeedQuiz}
            speedQuizIndex={speedQuizIndex}
            speedQuizTotal={speedQuizTotal}
            myStreak={myStreak}
            myScore={myScore}
            SuspenseFallback={SuspenseFallback}
            WaitingPage={WaitingPage}
            ActivePollView={ActivePollView}
            StudentHeader={StudentHeader}
          />
        </motion.div>
      </AnimatePresence>

      <DrumrollOverlay active={!!session?.drumroll} />
      <ChatBubbleOverlay sessionId={sessionId} />
      <AchievementToast achievements={achievements} />
    </>
  );
});
