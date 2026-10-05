import { useMemo } from 'react';
import { getParticipantId } from '@/lib/participant';
import { isAnswerCorrect } from '@/lib/quiz';
import { responseQuestionEntries } from '@/lib/response-questions';

/**
 * Achievement definitions.
 * Each has: id, label (Korean), description, icon name (lucide), check function.
 * check(ctx) receives: { answered, correct, gradable, streak, bestStreak, totalScore, fastestAnswer, totalQuestions, correctRate }
 */
const ACHIEVEMENTS = [
  {
    id: 'first-correct',
    label: '첫 정답',
    description: '첫 번째 정답을 맞혔습니다',
    icon: 'Sparkle',
    check: (ctx) => ctx.correct >= 1,
  },
  {
    id: 'streak-5',
    label: '5연속 정답',
    description: '5문제 연속으로 정답!',
    icon: 'Flame',
    check: (ctx) => ctx.bestStreak >= 5,
  },
  {
    id: 'full-participation',
    label: '전문항 참여',
    description: '응답할 수 있는 모든 질문에 참여했습니다',
    icon: 'CheckCheck',
    check: (ctx) => ctx.totalQuestions > 0 && ctx.answered >= ctx.totalQuestions,
  },
  {
    id: 'lightning-fast',
    label: '번개 응답',
    description: '3초 이내에 답변을 제출했습니다',
    icon: 'Zap',
    check: (ctx) => ctx.fastestAnswer !== null && ctx.fastestAnswer <= 3000,
  },
  {
    id: 'perfect-score',
    label: '만점왕',
    description: '모든 정답을 맞혔습니다',
    icon: 'Crown',
    check: (ctx) => ctx.gradable >= 3 && ctx.correctRate === 100,
  },
];

/**
 * Compute achievement context from session questions for a given participant.
 */
function computeContext(questions, participantId, scores, sorted = responseQuestionEntries(questions)
  .sort((a, b) => (a[1].order || 0) - (b[1].order || 0))) {
  let answered = 0;
  let correct = 0;
  let gradable = 0;
  let currentStreak = 0;
  let bestStreak = 0;
  let fastestAnswer = null;

  sorted.forEach(([, q]) => {
    const myVote = q.votes?.[participantId];
    if (myVote) {
      answered++;
      if (q.correctAnswer) {
        gradable++;
        if (isAnswerCorrect(q, myVote.value)) { // 텍스트형 공백·대소문자 무시
          correct++;
          currentStreak++;
          if (currentStreak > bestStreak) bestStreak = currentStreak;
        } else {
          currentStreak = 0;
        }
      }
      // Check speed (for quiz/choice/ox with activatedAt)
      if (q.activatedAt && myVote.timestamp) {
        const elapsed = myVote.timestamp - q.activatedAt;
        if (elapsed > 0 && (fastestAnswer === null || elapsed < fastestAnswer)) {
          fastestAnswer = elapsed;
        }
      }
    }
  });

  // Use bestStreak from scores if available (may be more accurate for real-time)
  const scoreBestStreak = scores?.[participantId]?.bestStreak || 0;
  if (scoreBestStreak > bestStreak) bestStreak = scoreBestStreak;

  const totalQuestions = sorted.length;
  const correctRate = gradable > 0 ? Math.round((correct / gradable) * 100) : 0;

  return {
    answered,
    correct,
    gradable,
    streak: currentStreak,
    bestStreak,
    totalScore: scores?.[participantId]?.total || 0,
    fastestAnswer,
    totalQuestions,
    correctRate,
  };
}

/**
 * Hook: compute which achievements the current student has earned.
 * Returns { achievements: Array<{id, label, description, icon}>, context }
 * No Firebase writes needed — purely computed from existing session data.
 */
export function useAchievements(session, scores) {
  const participantId = getParticipantId();

  return useMemo(() => {
    const ctx = computeContext(session?.questions, participantId, scores);
    const earned = ACHIEVEMENTS.filter((a) => a.check(ctx));
    return {
      achievements: earned.map(({ id, label, description, icon }) => ({ id, label, description, icon })),
      context: ctx,
    };
  }, [session?.questions, scores, participantId]);
}

/**
 * Compute aggregate achievement stats across all participants.
 * Returns array of { id, label, description, icon, count } for earned achievements.
 */
export function computeAchievementStats(questions, scores, participantIds) {
  // A class overview evaluates the same activities for every participant. Filter
  // and sort once instead of allocating/sorting the list again for each learner.
  const sorted = responseQuestionEntries(questions)
    .sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
  const counts = {};
  ACHIEVEMENTS.forEach((a) => { counts[a.id] = 0; });

  participantIds.forEach((pid) => {
    const ctx = computeContext(questions, pid, scores, sorted);
    ACHIEVEMENTS.forEach((a) => {
      if (a.check(ctx)) counts[a.id]++;
    });
  });

  return ACHIEVEMENTS
    .map((a) => ({ id: a.id, label: a.label, description: a.description, icon: a.icon, count: counts[a.id] }))
    .filter((a) => a.count > 0);
}

/**
 * Compute achievements for a specific participant (no hooks).
 * Used by report page where participantId comes from URL, not localStorage.
 */
export function computeAchievements(questions, participantId, scores) {
  const ctx = computeContext(questions, participantId, scores);
  return ACHIEVEMENTS
    .filter((a) => a.check(ctx))
    .map(({ id, label, description, icon }) => ({ id, label, description, icon }));
}

/** Export achievement definitions for admin views. */
export { ACHIEVEMENTS };
