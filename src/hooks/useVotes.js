import { useRealtimeValue } from '@/hooks/useRealtimeValue';
import { useRealtimeRecord } from '@/hooks/useRealtimeRecord';
import { getStaffSession } from '@/lib/auth-session';
import { EMPTY_RECORD, adaptiveVoteThrottle } from '@/lib/realtime';
import { summarizeVotes } from '@/lib/classroom-data';
import { readQuizDistribution } from '@/lib/quiz-distribution';
import { useMemo, useCallback } from 'react';
const ACCESS_FIELDS = ['type', 'revealedAt', 'activatedAt', 'options'];

export function useVotes(sessionId, questionId) {
  const privileged = Boolean(getStaffSession());
  const { value: access, loading: accessLoading, error: accessError } = useRealtimeRecord(!privileged && sessionId && questionId ? `sessions/${sessionId}/publicQuestions/${questionId}` : null, ACCESS_FIELDS);
  // 공개 전에는 개인별 원본을 구독하지 않는다. 안전한 숫자 집계만 읽고,
  // 정답 공개 후에는 기존 전체 집계/명단 기능을 그대로 유지한다.
  const aggregateOnly = !privileged && access?.type === 'quiz' && !access.revealedAt;
  const resultsHidden = !privileged && !access?.type;
  const revealScope = !privileged && access?.type === 'quiz' ? access.revealedAt : undefined;
  const { value, error, loading } = useRealtimeValue(sessionId && questionId && !resultsHidden && !aggregateOnly ? `sessions/${sessionId}/questions/${questionId}/votes` : null, { scope: revealScope, throttleMs: adaptiveVoteThrottle });
  const { value: publicAggregate, loading: aggregateLoading, error: aggregateError } = useRealtimeValue(aggregateOnly && sessionId && questionId ? `sessions/${sessionId}/publicQuizAggregates/${questionId}` : null, { scope: access?.activatedAt || 0, throttleMs: 100 });
  const votes = value || EMPTY_RECORD;

  const { voteList, tallied: rawTally, totalVotes: rawTotal } = useMemo(() => summarizeVotes(votes), [votes]);
  const aggregate = useMemo(() => aggregateOnly ? readQuizDistribution(publicAggregate, access?.options || [], access?.activatedAt || 0) : null, [aggregateOnly, publicAggregate, access?.options, access?.activatedAt]);
  const tallied = aggregateOnly ? aggregate?.tallied || EMPTY_RECORD : rawTally;
  const totalVotes = aggregateOnly ? aggregate?.totalVotes || 0 : rawTotal;

  const countByValue = useCallback(
    (value) => tallied[value] || 0,
    [tallied]
  );

  /** Returns the pre-computed tally object (stable ref). */
  const tally = useCallback(() => tallied, [tallied]);

  return { error: error || accessError || aggregateError, loading: accessLoading || (aggregateOnly ? aggregateLoading : loading), resultsHidden, votes, voteList, totalVotes, countByValue, tally };
}
