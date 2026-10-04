import { useRealtimeValue } from '@/hooks/useRealtimeValue';
import { EMPTY_RECORD } from '@/lib/realtime';
import { useMemo } from 'react';

export function useUrgentQuestions(sessionId) {
  const { value } = useRealtimeValue(sessionId ? `sessions/${sessionId}/urgentQuestions` : null);
  const questions = value || EMPTY_RECORD;

  const questionList = useMemo(
    () =>
      Object.entries(questions)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)),
    [questions]
  );

  const unreadCount = useMemo(
    () => questionList.filter((q) => !q.read).length,
    [questionList]
  );

  return { questions, questionList, unreadCount };
}
