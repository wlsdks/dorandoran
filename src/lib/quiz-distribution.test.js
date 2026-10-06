import { describe, expect, it } from 'vitest';
import { quizDistribution, readQuizDistribution, shouldReportPublishFailure } from './quiz-distribution';

describe('공개 전 퀴즈 비율의 정보 경계', () => {
  it('200명의 개인 정보를 옵션별 숫자로만 표현한다', () => {
    const input = quizDistribution(['A', 'B'], value => value === 'A' ? 150 : 50, 42);
    expect(input).toEqual({ round: 42, total: 200, counts: [150, 50] });
    expect(JSON.stringify(input).length).toBeLessThan(100);
    expect(Object.keys(input)).toEqual(['round', 'total', 'counts']);
  });
  it('초기화 이전 회차와 불일치/소수/음수 집계를 화면에 표시하지 않는다', () => {
    const valid = { round: 42, total: 200, counts: [150, 50] };
    expect(readQuizDistribution(valid, ['A', 'B'], 43)).toBeNull();
    for (const counts of [[150, 49], [150.5, 49.5], [-1, 201], [150, undefined]]) {
      expect(readQuizDistribution({ ...valid, counts }, ['A', 'B'], 42)).toBeNull();
    }
    expect(readQuizDistribution(valid, ['A', 'B'], 42)).toMatchObject({ totalVotes: 200, tallied: { A: 150, B: 50 } });
  });
  it('0명과 레거시 회차를 지원하고 예약된 문자열을 객체 프로토타입으로 해석하지 않는다', () => {
    const value = quizDistribution(['__proto__', 'constructor'], () => 0);
    const result = readQuizDistribution(value, ['__proto__', 'constructor']);
    expect(result.totalVotes).toBe(0);
    expect(Object.getPrototypeOf(result.tallied)).toBeNull();
    expect(result.tallied.__proto__).toBe(0);
  });
});

describe('집계 전송 실패 보고 정책', () => {
  it('활성화 직후 round가 늦게 오는 첫 거부는 다음 전송으로 넘기고, 같은 범위의 두 번째 실패부터 알린다', () => {
    expect(shouldReportPublishFailure(0)).toBe(false);
    expect(shouldReportPublishFailure(1)).toBe(false);
    expect(shouldReportPublishFailure(2)).toBe(true);
    expect(shouldReportPublishFailure(5)).toBe(true);
  });
});
