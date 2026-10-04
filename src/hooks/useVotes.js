import { useRealtimeValue } from '@/hooks/useRealtimeValue';
import { EMPTY_RECORD, adaptiveVoteThrottle } from '@/lib/realtime';
import { useMemo, useCallback } from 'react';

export function useVotes(sessionId, questionId) {
  const { value, error } = useRealtimeValue(sessionId && questionId ? `sessions/${sessionId}/questions/${questionId}/votes` : null, { throttleMs: adaptiveVoteThrottle });
  const votes = value || EMPTY_RECORD;

  const voteList = useMemo(
    () => Object.entries(votes).map(([id, data]) => ({ id, ...data })),
    [votes]
  );

  const totalVotes = voteList.length;

  /** Pre-computed tally: { value: count } */
  const tallied = useMemo(() => {
    const counts = Object.create(null);
    voteList.forEach(v => {
      counts[v.value] = (counts[v.value] || 0) + 1;
    });
    return counts;
  }, [voteList]);

  const countByValue = useCallback(
    (value) => tallied[value] || 0,
    [tallied]
  );

  /** Returns the pre-computed tally object (stable ref). */
  const tally = useCallback(() => tallied, [tallied]);

  return { error, votes, voteList, totalVotes, countByValue, tally };
}
