import { describe, expect, it } from 'vitest';
import { isQuizTallyStale, QUIZ_HEARTBEAT_MS } from './quiz-distribution';

describe('전자칠판 퀴즈 집계 끊김 판단', () => {
  it('문항이 열린 직후에는 집계가 없어도 기다린다', () => {
    expect(isQuizTallyStale(null, { now: 5000, activatedAt: 1000 })).toBe(false);
  });
  it('유예 시간이 지나도 집계가 없으면 끊김', () => {
    expect(isQuizTallyStale(null, { now: 20000, activatedAt: 1000 })).toBe(true);
  });
  it('최근 신호가 있으면 정상, 3주기 넘게 없으면 끊김', () => {
    expect(isQuizTallyStale({ heartbeat: 100000 }, { now: 100000 + QUIZ_HEARTBEAT_MS })).toBe(false);
    expect(isQuizTallyStale({ heartbeat: 100000 }, { now: 100000 + QUIZ_HEARTBEAT_MS * 3 + 1 })).toBe(true);
  });
  it('신호 필드가 없는 예전 집계나 시간을 모르면 판단하지 않는다', () => {
    expect(isQuizTallyStale({ total: 3 }, { now: 1e12 })).toBe(false);
    expect(isQuizTallyStale(null, { now: NaN, activatedAt: 1 })).toBe(false);
  });
});
