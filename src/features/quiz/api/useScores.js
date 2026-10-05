import { useRealtimeValue } from '@/hooks/useRealtimeValue';
import { EMPTY_RECORD } from '@/lib/realtime';
import { ref, set } from 'firebase/database';
import { summarizeScores } from '@/lib/classroom-data';
import { useMemo, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { getParticipantId } from '@/lib/participant';

/**
 * 학생 전용 경량 훅 — 본인 점수 노드만 구독.
 * 전체 scores 컬렉션(300명) 구독 대신 sessions/{id}/scores/{pid}만 onValue.
 * 300명 동시접속 fan-out 방지 — 전체 leaderboard가 필요한 곳만 useScores 사용.
 */
export function useMyScore(sessionId) {
  const pid = getParticipantId();
  const { value: myScore } = useRealtimeValue(sessionId && pid ? `sessions/${sessionId}/scores/${pid}` : null);

  return { myScore };
}

export function useScores(sessionId) {
  const { value } = useRealtimeValue(sessionId ? `sessions/${sessionId}/scores` : null);
  const scores = value || EMPTY_RECORD;

  const leaderboard = useMemo(() => summarizeScores(scores), [scores]);

  const resetScores = useCallback(async () => {
    if (!sessionId) return;
    // Reset all scores to 0 but keep nicknames
    const resetData = Object.create(null);
    Object.entries(scores).forEach(([id, data]) => {
      resetData[id] = { ...data, nickname: data.nickname, total: 0 };
    });
    await set(ref(db, `sessions/${sessionId}/scores`), resetData);
  }, [sessionId, scores]);

  return { scores, leaderboard, resetScores };
}
