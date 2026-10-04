import { useRealtimeValue } from '@/hooks/useRealtimeValue';


/**
 * Student-side hook to detect speed quiz mode.
 * Read-only — just watches the speedQuiz state from Firebase.
 */
export function useSpeedQuizStudent(sessionId) {
  const { value: speedQuiz } = useRealtimeValue(sessionId ? `sessions/${sessionId}/speedQuiz` : null);

  return {
    isSpeedQuiz: speedQuiz?.active === true,
    totalQuestions: speedQuiz?.totalQuestions || 0,
  };
}
