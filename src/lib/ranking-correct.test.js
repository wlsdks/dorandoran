import { describe, expect, it } from 'vitest';
import { isAnswerCorrect } from './quiz';

describe('순위 맞추기 정답 판정', () => {
  const question = { type: 'ranking', correctAnswer: '0,1,2,3' };
  it('네 개 순서가 모두 맞아야 정답이다', () => {
    expect(isAnswerCorrect(question, '0,1,2,3')).toBe(true);
  });
  it('하나라도 자리가 틀리면 오답이다(부분 점수 없음)', () => {
    expect(isAnswerCorrect(question, '0,1,3,2')).toBe(false);
    expect(isAnswerCorrect(question, '1,0,2,3')).toBe(false);
    expect(isAnswerCorrect(question, '3,2,1,0')).toBe(false);
  });
  it('정답이 번호 순서(0,2,3,1)여도 투표 값이 정확히 같을 때만 정답이다', () => {
    const numbered = { type: 'ranking', correctAnswer: '0,2,3,1' };
    expect(isAnswerCorrect(numbered, '0,2,3,1')).toBe(true);
    expect(isAnswerCorrect(numbered, '0,1,2,3')).toBe(false);
    expect(isAnswerCorrect(numbered, '0,2,1,3')).toBe(false);
    expect(isAnswerCorrect(numbered, '0,2,3')).toBe(false);
  });
});
