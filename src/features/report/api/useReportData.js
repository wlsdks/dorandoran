import { useMemo } from 'react';
import { auth, getStaffSession } from '@/lib/auth-session';
import { useAIAvailability } from '@/hooks/useAIAvailability';
import { useSession } from '@/features/session/api/useSession';
import { useScores } from '@/features/quiz/api/useScores';
import { computeAchievements } from '@/features/quiz/api/useAchievements';
import { TYPE_LABELS } from '@/lib/question-types';
import { questionResponseState, summarizeParticipantResponses } from '@/lib/response-questions';

/**
 * Loads all data needed for a student's learning report.
 * Accepts participantId as a parameter (from URL) instead of localStorage.
 *
 * @param {string} sessionId
 * @param {string} participantId
 */
export function useReportData(sessionId, participantId) {
  const authorized = Boolean(participantId && (auth.currentUser?.uid === participantId || getStaffSession()));
  const { available: aiAvailable } = useAIAvailability();
  const { session, loading: sessionLoading, error } = useSession(authorized ? sessionId : null, { participantId: authorized ? participantId : undefined });
  const { scores, leaderboard } = useScores(authorized ? sessionId : null);

  const stats = useMemo(() => {
    if (!session || !participantId || !authorized) return null;

    const questions = session.questions || {};
    const questionEntries = Object.entries(questions)
      .sort((a, b) => (a[1].order || 0) - (b[1].order || 0));

    const { answeredCount, totalQuestions, correctCount, gradableCount } = summarizeParticipantResponses(questions, participantId);

    const questionDetails = questionEntries.map(([qId, q]) => {
      return {
        id: qId,
        title: q.title,
        type: q.type,
        typeLabel: q.type === 'aiJudge' && !aiAvailable ? '과제' : TYPE_LABELS[q.type] || q.type,
        ...questionResponseState(q, participantId),
      };
    });

    const myScore = scores[participantId];
    const rankIdx = leaderboard.findIndex((e) => e.id === participantId);

    return {
      nickname: myScore?.nickname || null,
      courseName: session.courseName,
      roundNumber: session.roundNumber,
      answeredCount,
      totalQuestions,
      correctRate: gradableCount > 0 ? Math.round((correctCount / gradableCount) * 100) : null,
      totalScore: myScore?.total || 0,
      bestStreak: myScore?.bestStreak || myScore?.streak || 0,
      rank: rankIdx >= 0 ? rankIdx + 1 : 0,
      totalParticipants: leaderboard.length,
      questionDetails,
    };
  }, [session, scores, leaderboard, participantId, authorized, aiAvailable]);

  const achievements = useMemo(() => {
    if (!session || !participantId) return [];
    return computeAchievements(session.questions, participantId, scores);
  }, [session, participantId, scores]);

  return {
    stats,
    achievements,
    authorized,
    error,
    loading: sessionLoading,
  };
}
