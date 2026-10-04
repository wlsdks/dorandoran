import { useRealtimeValue } from '@/hooks/useRealtimeValue';
import { EMPTY_RECORD } from '@/lib/realtime';
import { useMemo } from 'react';
import { getParticipantId } from '@/lib/participant';

/**
 * 학생 전용 경량 훅 — 본인 손들기 상태(boolean)만 구독.
 * 전체 handRaises 컬렉션(300명) 구독 대신 sessions/{id}/handRaises/{pid}만 onValue.
 * 강사/스태프(전체 목록 필요)는 useHandRaises 사용.
 */
export function useMyHandRaise(sessionId) {
  const pid = getParticipantId();
  const { value } = useRealtimeValue(sessionId && pid ? `sessions/${sessionId}/handRaises/${pid}` : null);
  const raised = value?.raised === true;

  return { raised };
}

export function useHandRaises(sessionId) {
  const { value } = useRealtimeValue(sessionId ? `sessions/${sessionId}/handRaises` : null);
  const handRaises = value || EMPTY_RECORD;

  const raisedList = useMemo(
    () =>
      Object.entries(handRaises)
        .filter(([, data]) => data.raised)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => (a.raisedAt || 0) - (b.raisedAt || 0)),
    [handRaises]
  );

  return { handRaises, raisedList, count: raisedList.length };
}
