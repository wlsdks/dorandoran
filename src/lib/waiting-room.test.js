import { describe, expect, it } from 'vitest';
import { parseWaitingRoom, selectWaitingRoom, summarizeWaitingRoom, waitingStatus } from './waiting-room';

const online = { a: true };
const participants = {
  p1: { nickname: '민지', joinedAt: 1000, connections: online },
  p2: { nickname: '준호', joinedAt: 4000, connections: online },
  p3: { nickname: '서연', joinedAt: 3000, connections: { a: false } },
  p4: { nickname: '도윤', joinedAt: 2000, connections: online },
  p5: { nickname: '  ', joinedAt: 5000, connections: online },
  p6: { nickname: '하늘', connections: online },
  junk: 'not-an-object',
};

describe('대기 화면 참여자 요약', () => {
  it('접속 중인 사람만 세고 최근 입장 순으로 이름을 고른다', () => {
    const { count, recent } = summarizeWaitingRoom(participants, { limit: 2 });
    expect(count).toBe(5);
    expect(recent.map(r => r.nickname)).toEqual(['준호', '도윤']);
  });
  it('입장 시각이나 이름이 없는 사람은 최근 목록에서 뺀다', () => {
    const { recent } = summarizeWaitingRoom(participants);
    expect(recent.map(r => r.id)).toEqual(['p2', 'p4', 'p1']);
  });
  it('빈 값은 0명', () => {
    expect(summarizeWaitingRoom(null)).toEqual({ count: 0, recent: [] });
  });
  it('select 문자열은 같은 내용이면 동일하고 parse로 복원된다', () => {
    const a = selectWaitingRoom(participants), b = selectWaitingRoom({ ...participants });
    expect(a).toBe(b);
    expect(parseWaitingRoom(a)).toEqual(summarizeWaitingRoom(participants));
    expect(parseWaitingRoom(undefined)).toEqual({ count: 0, recent: [] });
    expect(parseWaitingRoom('{bad')).toEqual({ count: 0, recent: [] });
  });
});

describe('대기 상태', () => {
  it('강사가 투표 모드에서 문항을 고르는 중이면 soon', () => {
    expect(waitingStatus({ currentMode: 'poll', currentQuestion: null })).toBe('soon');
    expect(waitingStatus({ currentMode: 'quiz', currentQuestion: '' })).toBe('soon');
  });
  it('예고된 이벤트가 우선한다', () => {
    expect(waitingStatus({ currentMode: 'poll', currentQuestion: null, pendingEvent: { type: 'double' } })).toBe('event');
  });
  it('그 외는 idle', () => {
    expect(waitingStatus({ currentMode: 'waiting' })).toBe('idle');
    expect(waitingStatus({ currentMode: 'poll', currentQuestion: 'q1' })).toBe('idle');
    expect(waitingStatus()).toBe('idle');
  });
});
