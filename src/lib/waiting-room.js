import { participantIsOnline } from './participants';

const RECENT_LIMIT = 4;

/**
 * 학생 대기 화면용 참여자 요약 — 접속 중 인원과 최근 입장한 사람 이름.
 * 300명 세션에서 입장마다 전원이 리렌더되지 않도록 구독 select는 문자열(JSON)을 돌려주고,
 * 같은 내용이면 Object.is가 같아 스토어가 알림을 생략한다.
 */
export function summarizeWaitingRoom(participants, { limit = RECENT_LIMIT } = {}) {
  const entries = Object.entries(participants && typeof participants === 'object' ? participants : {})
    .filter(([, person]) => person && typeof person === 'object' && participantIsOnline(person));
  const recent = entries
    .filter(([, person]) => Number.isFinite(person.joinedAt) && typeof person.nickname === 'string' && person.nickname.trim())
    .sort((a, b) => b[1].joinedAt - a[1].joinedAt)
    .slice(0, limit)
    .map(([id, person]) => ({ id, nickname: person.nickname.trim(), joinedAt: person.joinedAt }));
  return { count: entries.length, recent };
}

export function selectWaitingRoom(raw) {
  return JSON.stringify(summarizeWaitingRoom(raw));
}

export function parseWaitingRoom(serialized) {
  if (typeof serialized !== 'string') return { count: 0, recent: [] };
  try {
    const parsed = JSON.parse(serialized);
    return { count: Number(parsed?.count) || 0, recent: Array.isArray(parsed?.recent) ? parsed.recent : [] };
  } catch { return { count: 0, recent: [] }; }
}

/**
 * 대기 화면 상태 문구. 실제 세션 값만 근거로 삼는다.
 * - soon: 강사가 투표/퀴즈 모드에 들어와 다음 문항을 고르는 중(currentQuestion 없음)
 * - event: 예고된 퀴즈 이벤트가 있음
 * - idle: 그 외 일반 대기
 */
export function waitingStatus({ currentMode, currentQuestion, pendingEvent } = {}) {
  if (pendingEvent) return 'event';
  if ((currentMode === 'poll' || currentMode === 'quiz') && !currentQuestion) return 'soon';
  return 'idle';
}
