import { useRealtimeValue } from '@/hooks/useRealtimeValue';
import { useRealtimeRecord } from '@/hooks/useRealtimeRecord';
import { getStaffSession } from '@/lib/auth-session';
import { EMPTY_RECORD, adaptiveVoteThrottle } from '@/lib/realtime';
import { useMemo, useCallback } from 'react';
const ACCESS_FIELDS = ['type', 'revealedAt'];

export function useVotes(sessionId, questionId) {
  const privileged = Boolean(getStaffSession());
  const { value: access, loading: accessLoading, error: accessError } = useRealtimeRecord(!privileged && sessionId && questionId ? `sessions/${sessionId}/publicQuestions/${questionId}` : null, ACCESS_FIELDS);
  // RTDB의 permission_denied는 구독을 끝낸다. 공개 전에는 구독하지 않고,
  // 안전한 공개 메타데이터가 바뀌면 새 구독을 시작한다. 강사는 계속 원본을 집계한다.
  const resultsHidden = !privileged && (!access?.type || (access.type === 'quiz' && !access.revealedAt));
  const revealScope = !privileged && access?.type === 'quiz' ? access.revealedAt : undefined;
  const { value, error, loading } = useRealtimeValue(sessionId && questionId && !resultsHidden ? `sessions/${sessionId}/questions/${questionId}/votes` : null, { scope: revealScope, throttleMs: adaptiveVoteThrottle });
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

  return { error: error || accessError, loading: loading || accessLoading, resultsHidden, votes, voteList, totalVotes, countByValue, tally };
}
