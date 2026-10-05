import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, Globe } from 'lucide-react';
import { embedDisplayUrl, safeEmbedUrl } from '@/lib/embed';
import { useMyVote } from '@/hooks/useMyVote';
import ChoiceVoter from '@/features/voting/components/ChoiceVoter';
import OXVoter from '@/features/voting/components/OXVoter';
import QuizVoter from '@/features/voting/components/QuizVoter';
import TextInput from '@/features/voting/components/TextInput';
import SubjectiveVoter from '@/features/voting/components/SubjectiveVoter';
import ScaleVoter from '@/features/voting/components/ScaleVoter';
import DebateVoter from '@/features/voting/components/DebateVoter';
import RankingVoter from '@/features/voting/components/RankingVoter';
import FillBlankVoter from '@/features/voting/components/FillBlankVoter';
import ShortAnswerVoter from '@/features/voting/components/ShortAnswerVoter';
import CheckVoter from '@/features/voting/components/CheckVoter';
import MysteryBoxVoter from '@/features/voting/components/MysteryBoxVoter';
import HintQuizVoter from '@/features/voting/components/HintQuizVoter';
import CorrectAnswerRanking from '@/features/visualization/components/CorrectAnswerRanking';
import ImageSlidePresenter from '@/features/visualization/components/ImageSlidePresenter';
import AiJudgeSubmitter from '@/features/ai-judge/components/AiJudgeSubmitter';
import PersistentAssignmentCard from '@/features/ai-judge/components/PersistentAssignmentCard';
import AnswerRevealCard from '@/components/ui/AnswerRevealCard';
import { getParticipantId } from '@/lib/participant';
import StudentHeader from './StudentHeader';
import StudentBottomBar from './StudentBottomBar';
import QuestionCard from './QuestionCard';
import ReviewingBanner from '@/components/ui/ReviewingBanner';
import QuizEventBanner from '@/components/ui/QuizEventBanner';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import TimerCountdown from '@/features/timer/components/TimerCountdown';
import SpeedQuizBanner from '@/features/quiz/components/SpeedQuizBanner';
import SpeedQuizCombo from '@/features/quiz/components/SpeedQuizCombo';
import StreakBadge from '@/features/quiz/components/StreakBadge';
import { QuizResultFromVote, TimerExpiredBanner } from './VoteHelpers';

/**
 * 활성 투표/퀴즈 뷰 — 질문 카드 + 타이머 + 투표 영역
 */
export default memo(function ActivePollView({
  sessionId,
  question,
  questionId,
  questionProgress,
  // Timer
  timerRunning,
  endTime,
  duration,
  timerExpired,
  onTimerExpire,
  // Quiz / speed quiz
  isSpeedQuiz,
  speedQuizIndex,
  speedQuizTotal,
  myStreak,
  myScore,
  // Persistent (상시) 과제
  persistentAssignmentId,
  persistentAssignmentTitle,
}) {
  const { myVote } = useMyVote(sessionId, questionId);
  const hasVoted = !!myVote;
  // P1-7: 타이머 만료 또는 정답 공개 시 vote 입력 차단 (서버 rules와 이중 방어)
  const votingLocked = timerExpired || !!question?.revealedAt;

  return (
    <div className={`min-h-dvh bg-slate-50 dark:bg-slate-900 flex flex-col items-center px-4 sm:px-5 ${question.type === 'ranking' && !hasVoted ? 'pb-[calc(11rem+env(safe-area-inset-bottom))]' : 'pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-28'} pt-[calc(5.5rem+env(safe-area-inset-top))] sm:pt-[calc(5rem+env(safe-area-inset-top))]`}>
      <StudentHeader sessionId={sessionId} />

      <div className="w-full min-w-0 max-w-xl space-y-5 sm:my-auto">
        {/* 상시 과제 — 수업 내내 노출, 다른 질문과 독립적 */}
        {persistentAssignmentId && (
          <PersistentAssignmentCard
            sessionId={sessionId}
            questionId={persistentAssignmentId}
            questionTitle={persistentAssignmentTitle}
          />
        )}
        {/* Speed quiz banner */}
        {isSpeedQuiz && question?.type === 'quiz' && (
          <SpeedQuizBanner
            currentIndex={speedQuizIndex}
            totalQuestions={speedQuizTotal}
          />
        )}

        {/* Speed quiz combo counter */}
        {isSpeedQuiz && question?.type === 'quiz' && myStreak >= 1 && (
          <SpeedQuizCombo streak={myStreak} />
        )}

        {/* Streak badge — shown on regular quiz (non-speed) when 3+ streak */}
        {!isSpeedQuiz && question?.type === 'quiz' && myStreak >= 3 && (
          <StreakBadge streak={myStreak} />
        )}

        {/* Question title card */}
        {question.type !== 'fillinblank' && <QuestionCard
          question={question}
          questionId={questionId}
          questionProgress={questionProgress}
        />}

        {/* Timer countdown bar */}
        <AnimatePresence>
          {timerRunning && !timerExpired && (
            <TimerCountdown
              endTime={endTime}
              duration={duration}
              onExpire={onTimerExpire}
            />
          )}
        </AnimatePresence>

        {/* Timer expired banner — 투표 안 한 학생에게만 */}
        <AnimatePresence>
          {timerExpired && !hasVoted && <TimerExpiredBanner />}
        </AnimatePresence>

        {question.type === 'quiz' && question.event && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.04 }}
          >
            <QuizEventBanner
              event={question.event}
              state={question.revealedAt ? 'result' : 'active'}
            />
          </motion.div>
        )}

        {/* Voter area */}
        <ErrorBoundary scope="voter" fullPage={false}>
          <AnimatePresence mode="wait">
            {/* activatedAt을 key에 포함 — 강사가 '답변 초기화'(activatedAt=null)/재활성 시 voter가
                remount되어 voted/submitted 로컬 state가 초기화됨(학생이 다시 투표 가능). 투표 중엔
                activatedAt이 안 변하므로 불필요한 remount 없음. */}
            <motion.div
              key={`voter-${questionId}-${question.activatedAt ?? 'na'}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.08 }}
              className="relative"
            >
              {question.type === 'choice' && (
                question.revealedAt && question.correctAnswer
                  ? <AnswerRevealCard correctAnswer={question.correctAnswer} myAnswer={myVote} />
                  : <ChoiceVoter sessionId={sessionId} questionId={questionId} options={question.options || []} disabled={votingLocked} />
              )}
              {question.type === 'quiz' && (
                <QuizVoter
                  sessionId={sessionId}
                  questionId={questionId}
                  question={question}
                  disabled={votingLocked}
                  renderResult={(currentVote) => (
                    <QuizResultFromVote question={question} currentVote={currentVote} streak={myStreak} isSpeedQuiz={isSpeedQuiz} score={myScore} questionId={questionId} />
                  )}
                />
              )}
              {question.type === 'ox' && (
                question.revealedAt && question.correctAnswer
                  ? <AnswerRevealCard correctAnswer={question.correctAnswer} myAnswer={myVote} />
                  : <OXVoter sessionId={sessionId} questionId={questionId} disabled={votingLocked} />
              )}
              {question.type === 'wordcloud' && (
                <TextInput sessionId={sessionId} questionId={questionId} type="wordcloud" placeholder="단어를 입력하세요" maxLength={20} disabled={votingLocked} />
              )}
              {question.type === 'qna' && (
                <TextInput sessionId={sessionId} questionId={questionId} type="qna" placeholder="질문을 입력하세요" maxLength={200} disabled={votingLocked} />
              )}
              {question.type === 'subjective' && (
                <SubjectiveVoter sessionId={sessionId} questionId={questionId} disabled={votingLocked} />
              )}
              {question.type === 'scale' && (
                <ScaleVoter sessionId={sessionId} questionId={questionId} minLabel={question.minLabel} maxLabel={question.maxLabel} disabled={votingLocked} />
              )}
              {question.type === 'debate' && (
                <DebateVoter sessionId={sessionId} questionId={questionId} disabled={votingLocked} />
              )}
              {question.type === 'ranking' && (
                <RankingVoter sessionId={sessionId} questionId={questionId} options={question.options || []} disabled={votingLocked} />
              )}
              {question.type === 'fillinblank' && (
                question.revealedAt && question.correctAnswer
                  ? <AnswerRevealCard correctAnswer={question.correctAnswer} myAnswer={myVote} />
                  : <FillBlankVoter sessionId={sessionId} questionId={questionId} title={question.title} correctAnswer={question.correctAnswer} disabled={votingLocked} />
              )}
              {question.type === 'shortAnswer' && (
                question.revealedAt && question.correctAnswer
                  ? <AnswerRevealCard correctAnswer={question.correctAnswer} myAnswer={myVote} />
                  : <ShortAnswerVoter sessionId={sessionId} questionId={questionId} disabled={votingLocked} />
              )}
              {question.type === 'check' && (
                <CheckVoter sessionId={sessionId} questionId={questionId} disabled={votingLocked} />
              )}
              {question.type === 'imageSlide' && (
                <ImageSlidePresenter images={question.slideImages || []} currentSlide={question.currentSlide || 0} />
              )}
              {/* 웹페이지는 강사 화면·전자칠판에서 보여주는 자료다. 학생 폰에는 같은 주소를
                  새 창으로 열 수 있는 버튼만 준다(작은 화면에 남의 사이트를 끼워 넣지 않는다). */}
              {question.type === 'webEmbed' && safeEmbedUrl(question.embedUrl).url && (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <Globe size={28} className="text-slate-300 dark:text-slate-600" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    앞 화면에서 함께 보는 자료입니다
                  </p>
                  <a
                    href={safeEmbedUrl(question.embedUrl).url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2.5 text-sm font-medium active:scale-[0.98] transition-transform duration-150"
                  >
                    <ExternalLink size={15} />
                    내 폰에서 열기
                  </a>
                  <span className="text-xs text-slate-400 tabular-nums">{embedDisplayUrl(question.embedUrl)}</span>
                </div>
              )}
              {question.type === 'aiJudge' && (
                <AiJudgeSubmitter
                  sessionId={sessionId}
                  questionId={questionId}
                  disabled={votingLocked}
                />
              )}
              {question.type === 'mysteryBox' && (
                <>
                  {question.revealedAt && question.correctAnswer
                    ? <AnswerRevealCard correctAnswer={question.correctAnswer} myAnswer={myVote} />
                    : <MysteryBoxVoter sessionId={sessionId} questionId={questionId} disabled={votingLocked} />
                  }
                  {question.revealedAt && (
                    <CorrectAnswerRanking
                      sessionId={sessionId}
                      questionId={questionId}
                      correctAnswer={question.correctAnswer}
                      myParticipantId={getParticipantId()}
                    />
                  )}
                </>
              )}
              {question.type === 'hintQuiz' && (
                <>
                  {question.revealedAt && question.correctAnswer
                    ? <AnswerRevealCard correctAnswer={question.correctAnswer} myAnswer={myVote} />
                    : <HintQuizVoter
                        sessionId={sessionId}
                        questionId={questionId}
                        hints={question.hints || []}
                        revealedHints={question.revealedHints || 0}
                        disabled={votingLocked}
                      />
                  }
                  {question.revealedAt && (
                    <CorrectAnswerRanking
                      sessionId={sessionId}
                      questionId={questionId}
                      correctAnswer={question.correctAnswer}
                      acceptableAnswers={question.acceptableAnswers}
                      myParticipantId={getParticipantId()}
                    />
                  )}
                </>
              )}

            </motion.div>
          </AnimatePresence>
        </ErrorBoundary>
      </div>

      <ReviewingBanner sessionId={sessionId} />
      <StudentBottomBar sessionId={sessionId} />
    </div>
  );
});
