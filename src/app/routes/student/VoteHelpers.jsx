/* eslint-disable react-refresh/only-export-components -- vote 화면 helper 모음 (getModeVariants/ENTER_TRANSITION + 컴포넌트들) 의도적 collocation */
import { lazy } from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import QuizResult from '@/features/quiz/components/QuizResult';
import { getQuizReward } from '@/lib/quiz';
import { quizComboMultiplier } from '@/lib/quiz-awards';
import QuizScoreGuide from './QuizScoreGuide';

// --- Lazy-loaded mode pages ---
const LazyLeaderboardPage = lazy(() => import('./LeaderboardPage'));
const LazySessionEndedPage = lazy(() => import('./SessionEndedPage'));
const LazyClassQABoard = lazy(() => import('@/features/class-questions/components/ClassQABoard'));
const LazyFocusOverlay = lazy(() => import('@/features/session/components/FocusOverlay'));
const LazyComprehensionCheck = lazy(() => import('@/features/session/components/ComprehensionCheck'));
const LazyQuickSurvey = lazy(() => import('@/features/session/components/QuickSurvey'));
const LazyGroupDiscussion = lazy(() => import('@/features/session/components/GroupDiscussion'));

// --- Mode transition variants ---
// poll/quiz: slide up   leaderboard: curtain from top
// special modes: scale-in   waiting: fade   ended/reviewing: slide from below
export function getModeVariants(modeKey) {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
  }
  if (modeKey === 'leaderboard') {
    return {
      initial: {
        opacity: 0,
        y: -24
      },
      animate: {
        opacity: 1,
        y: 0
      },
      exit: {
        opacity: 0,
        y: 24
      }
    };
  }
  if (modeKey === 'ended' || modeKey === 'reviewing') {
    return {
      initial: {
        opacity: 0,
        y: 24,
        scale: 0.97
      },
      animate: {
        opacity: 1,
        y: 0,
        scale: 1
      },
      exit: {
        opacity: 0,
        y: -12,
        scale: 0.98
      }
    };
  }
  if (['focus', 'comprehension', 'quickSurvey', 'discussion', 'qaBoard'].includes(modeKey)) {
    return {
      initial: {
        opacity: 0,
        scale: 0.94
      },
      animate: {
        opacity: 1,
        scale: 1
      },
      exit: {
        opacity: 0,
        scale: 1.02
      }
    };
  }
  if (modeKey === 'waiting') {
    return {
      initial: {
        opacity: 0,
        y: 8
      },
      animate: {
        opacity: 1,
        y: 0
      },
      exit: {
        opacity: 0,
        y: -8
      }
    };
  }
  return {
    initial: {
      opacity: 0,
      y: 20
    },
    animate: {
      opacity: 1,
      y: 0
    },
    exit: {
      opacity: 0,
      y: -12
    }
  };
}

// Spring transition for mode changes (~0.3s enter)
export const ENTER_TRANSITION = {
  type: 'tween',
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1]
};

/** Renders QuizResult from vote data passed by QuizVoter. */
export function QuizResultFromVote({
  question,
  currentVote,
  streak = 0,
  isSpeedQuiz = false,
  score, questionId
}) {
  if (!currentVote) return null;
  const reward = getQuizReward(question, currentVote);
  // 스피드 퀴즈는 서버가 콤보 배수(3연속 1.2x, 5연속 1.5x)를 적용해 적립하므로,
  // 표시 점수도 동일 배수를 반영해야 '+점수'가 실제 가산점과 일치(정합성).
  const receipt = score?.quizAwards?.[questionId];
  const matchingReceipt = receipt?.round === question.revealedAt && Number.isFinite(receipt?.points);
  const matchingLegacy = Boolean(question.awardedAt && score?.lastQuestionId === questionId && Number.isFinite(score?.lastPoints));
  const scoreApplied = matchingReceipt || matchingLegacy;
  const speedRound = isSpeedQuiz || Boolean(question.speedQuizRound > 0 && question.speedQuizRound === question.activatedAt);
  const expected = speedRound && reward.isCorrect ? Math.round(reward.points * quizComboMultiplier(streak)) : reward.points;
  const points = matchingReceipt ? receipt.points : matchingLegacy ? score.lastPoints : 0;
  return <>
    <QuizResult isCorrect={reward.isCorrect} points={points} correctAnswer={question.correctAnswer} correctImage={question.optionImages?.[(question.options || []).indexOf(question.correctAnswer)] || null} correctLetter={(question.options || []).indexOf(question.correctAnswer) >= 0 ? String.fromCharCode(65 + (question.options || []).indexOf(question.correctAnswer)) : null} bet={reward.bet || 1} streak={scoreApplied && reward.isCorrect ? streak : 0} scoreApplied={scoreApplied} scoreDetails={<QuizScoreGuide question={question} vote={currentVote} points={scoreApplied ? points : undefined} streak={streak} isSpeedQuiz={speedRound} />} />
    {!scoreApplied && <p role="status" className="text-center text-sm text-slate-500 dark:text-slate-300">점수 반영을 확인하고 있어요{expected ? ` · 예상 ${expected}점` : ''}</p>}
  </>;

}

/** Timer expired banner — 상단 인라인 배너, voter 위에 띄우지 않음 */
export function TimerExpiredBanner() {
  return <motion.div initial={{
    opacity: 0,
    y: -8
  }} animate={{
    opacity: 1,
    y: 0
  }} exit={{
    opacity: 0,
    y: -8
  }} transition={{
    type: 'spring',
    stiffness: 300,
    damping: 25
  }} className="flex items-center gap-3 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-3">
      <Clock size={18} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight">시간이 종료되었습니다</p>
        <p className="text-xs opacity-70 mt-0.5">응답하지 못했어요 · 결과를 기다려주세요</p>
      </div>
    </motion.div>;
}

/**
 * VoteModeContent — dispatch component that renders the correct view per session mode.
 * Extracted from VotePage.jsx (448→133 lines). Imports are direct (no circular deps).
 */
export { VoteModeContent } from './VoteModeContent';
