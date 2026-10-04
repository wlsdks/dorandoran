import { describe, it, expect } from 'vitest';
import { getQuizReward, normalizeQuizEvent, getQuizEventBadges, isQuizQuestion, getQuestionMode, QUIZ_DEFAULTS } from './quiz';

// 특성화 테스트 — 리팩터 시 점수 계산이 바뀌지 않도록 현재 동작을 고정한다.
describe('getQuizReward', () => {
  const base = {
    type: 'quiz',
    correctAnswer: 'A',
    activatedAt: 1000
  };
  it("\uC815\uB2F5 + \uC989\uC2DC \uC81C\uCD9C \u2192 \uAE30\uBCF8100 + \uC18D\uB3C4\uBCF4\uB108\uC2A450", () => {
    const r = getQuizReward(base, {
      value: 'A',
      timestamp: 1000
    });
    expect(r.isCorrect).toBe(true);
    expect(r.points).toBe(150);
  });
  it('정답 + 속도창 절반 경과 → 속도보너스 절반(25)', () => {
    const r = getQuizReward(base, {
      value: 'A',
      timestamp: 1000 + 15000
    });
    expect(r.points).toBe(125);
  });
  it('정답 + 속도창 초과 → 속도보너스 0, 기본점수만', () => {
    const r = getQuizReward(base, {
      value: 'A',
      timestamp: 1000 + 40000
    });
    expect(r.points).toBe(100);
  });
  it("\uC624\uB2F5(\uBCA0\uD305 \uC5C6\uC74C) \u2192 0\uC810", () => {
    const r = getQuizReward(base, {
      value: 'B',
      timestamp: 2000
    });
    expect(r.isCorrect).toBe(false);
    expect(r.points).toBe(0);
  });
  it("\uBBF8\uC751\uB2F5(vote \uC5C6\uC74C) \u2192 0\uC810", () => {
    const r = getQuizReward(base, undefined);
    expect(r.isCorrect).toBe(false);
    expect(r.points).toBe(0);
  });
  it('베팅 활성 + 올인(3x) 오답 → 페널티 -60', () => {
    const r = getQuizReward({
      ...base,
      betting: true
    }, {
      value: 'B',
      bet: '3',
      timestamp: 2000
    });
    expect(r.points).toBe(-60);
  });
  it('베팅 활성 + 2x 정답(즉시) → 150 × 2 = 300', () => {
    const r = getQuizReward({
      ...base,
      betting: true
    }, {
      value: 'A',
      bet: '2',
      timestamp: 1000
    });
    expect(r.points).toBe(300);
  });
  it('double-points 이벤트 + 정답(즉시) → 150 × 2 = 300, 점수 멀티플라이어 적용', () => {
    const r = getQuizReward({
      ...base,
      event: 'double-points'
    }, {
      value: 'A',
      timestamp: 1000
    });
    expect(r.points).toBe(300);
  });
});
describe('normalizeQuizEvent', () => {
  it('null → null', () => expect(normalizeQuizEvent(null)).toBeNull());
  it('문자열 id → preset 객체', () => {
    expect(normalizeQuizEvent('double-points')).toMatchObject({
      id: 'double-points',
      pointMultiplier: 2
    });
  });
  it('객체 + id → preset과 병합', () => {
    const r = normalizeQuizEvent({
      id: "double-points",
      extra: 1
    });
    expect(r.pointMultiplier).toBe(2);
    expect(r.extra).toBeUndefined();
  });
});
describe('getQuizEventBadges', () => {
  it('double-points → 2배 점수 배지', () => {
    expect(getQuizEventBadges('double-points')).toContain('2배 점수');
  });
  it('없으면 빈 배열', () => expect(getQuizEventBadges(null)).toEqual([]));
});
describe('타입 판별', () => {
  it('isQuizQuestion', () => {
    expect(isQuizQuestion({
      type: 'quiz'
    })).toBe(true);
    expect(isQuizQuestion({
      type: 'choice'
    })).toBe(false);
  });
  it('getQuestionMode', () => {
    expect(getQuestionMode({
      type: 'quiz'
    })).toBe('quiz');
    expect(getQuestionMode({
      type: 'check'
    })).toBe('poll');
    expect(getQuestionMode({
      type: 'choice'
    })).toBe('poll');
  });
  it('QUIZ_DEFAULTS 불변', () => {
    expect(QUIZ_DEFAULTS).toMatchObject({
      points: 100,
      maxSpeedBonus: 50,
      speedWindowMs: 30000
    });
  });
});
