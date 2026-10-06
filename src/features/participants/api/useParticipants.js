import { participantIsOnline } from '@/lib/participants';
import { useRealtimeValue } from '@/hooks/useRealtimeValue';
import { EMPTY_RECORD } from '@/lib/realtime';
import { summarizeParticipants } from '@/lib/classroom-data';
import { parseWaitingRoom, selectWaitingRoom } from '@/lib/waiting-room';
import { useMemo } from 'react';

export function useParticipants(sessionId) {
  const { value } = useRealtimeValue(sessionId ? `sessions/${sessionId}/participants` : null);
  const participants = value || EMPTY_RECORD;

  const { list, onlineList, count } = useMemo(() => summarizeParticipants(participants), [participants]);

  return { participants, list, onlineList, count };
}

/**
 * 온라인 참여자 수만 필요한 화면용 경량 훅(예: 학생 WaitingPage).
 * 전체 useParticipants는 입장 1건마다 onValue 발화→full snapshot 머티리얼라이즈(O(N))+
 * 리렌더 → 300명 입장 폭주 시 모든 대기 학생 단말이 O(N²). 여기서는 throttle(300ms)로
 * 모아 처리하고 snap.val()도 flush 시점에만 호출, count가 바뀔 때만 setState한다.
 * @param {string} sessionId
 * @returns {number} 온라인 참여자 수
 */
export function useParticipantCount(sessionId) {
  const { value } = useRealtimeValue(sessionId ? `sessions/${sessionId}/participants` : null, { select: countOnline, throttleMs: 300 });
  const count = value || 0;
  return count;
}

/**
 * 대기 화면용 — 접속 인원 + 최근 입장한 사람 이름 몇 명.
 * select가 직렬화 문자열을 돌려주므로 내용이 같으면 리렌더되지 않는다(300명 입장 폭주 보호는 useParticipantCount와 동일).
 * @returns {{ count: number, recent: Array<{ id: string, nickname: string, joinedAt: number }> }}
 */
export function useWaitingRoom(sessionId) {
  const { value } = useRealtimeValue(sessionId ? `sessions/${sessionId}/participants` : null, { select: selectWaitingRoom, throttleMs: 300 });
  return useMemo(() => parseWaitingRoom(value), [value]);
}

function countOnline(value) {
  return Object.values(value || EMPTY_RECORD).filter((person) => participantIsOnline(person)).length;
}
