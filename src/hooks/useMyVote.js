import { useRealtimeValue } from '@/hooks/useRealtimeValue';
import { getParticipantId } from '@/lib/participant';

/**
 * Lightweight hook that checks if the current participant already voted.
 * Returns { myVote } — the vote value (string) or null.
 * Only subscribes to this one participant's vote node, not all votes.
 */
export function useMyVote(sessionId, questionId) {
  const pid = getParticipantId();
  const { value } = useRealtimeValue(sessionId && questionId && pid ? `sessions/${sessionId}/questions/${questionId}/votes/${pid}` : null);
  const myVote = value?.value ?? null;

  return { myVote };
}

/**
 * useMyVote의 전체 객체 버전 — 본인 vote 노드 전체({value, bet, confidence, ...})를 구독.
 * QuizVoter처럼 bet/confidence가 필요한 곳에서 votes 전체 컬렉션 구독을 대체.
 * Returns { myVote } — 본인 vote 객체 또는 null.
 */
export function useMyVoteFull(sessionId, questionId) {
  const pid = getParticipantId();
  const { value } = useRealtimeValue(sessionId && questionId && pid ? `sessions/${sessionId}/questions/${questionId}/votes/${pid}` : null);
  const myVote = value;

  return { myVote };
}
