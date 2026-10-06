import { describe, expect, it } from 'vitest';
import { formatTimeLimit, normalizeTimeLimit, supportsTimeLimit, timerForQuestion } from './question-timer';
import { buildQuestionData, QUESTION_TYPE_FIELDS } from './question';

describe('문항별 시간 제한', () => {
  it('5초~3600초 정수만 저장하고 나머지는 제한 없음', () => {
    expect(normalizeTimeLimit(30)).toBe(30);
    expect(normalizeTimeLimit('45')).toBe(45);
    expect(normalizeTimeLimit(12.6)).toBe(13);
    expect(normalizeTimeLimit(4)).toBeNull();
    expect(normalizeTimeLimit(3601)).toBeNull();
    expect(normalizeTimeLimit('')).toBeNull();
    expect(normalizeTimeLimit('abc')).toBeNull();
  });
  it('응답 문항만 지원한다', () => {
    expect(supportsTimeLimit('quiz')).toBe(true);
    expect(supportsTimeLimit('imageSlide')).toBe(false);
    expect(supportsTimeLimit('webEmbed')).toBe(false);
  });
  it('활성화 시 서버 시간 기준으로 끝나는 타이머를 만든다', () => {
    expect(timerForQuestion({ type: 'quiz', timerDuration: 30 }, 1000)).toEqual({ endTime: 31000, duration: 30, running: true });
    expect(timerForQuestion({ type: 'quiz' }, 1000)).toBeNull();
    expect(timerForQuestion({ type: 'imageSlide', timerDuration: 30 }, 1000)).toBeNull();
  });
  it('읽기 쉬운 표기', () => {
    expect(formatTimeLimit(15)).toBe('15초');
    expect(formatTimeLimit(60)).toBe('1분');
    expect(formatTimeLimit(90)).toBe('1분 30초');
    expect(formatTimeLimit(null)).toBe('제한 없음');
  });
  it('문항 저장 데이터에 들어가고, 수정 시 지울 수 있는 필드다', () => {
    expect(buildQuestionData('choice', { options: ['a', 'b'], timerDuration: 30 }).timerDuration).toBe(30);
    expect(buildQuestionData('choice', { options: ['a', 'b'], timerDuration: 2 }).timerDuration).toBeUndefined();
    expect(buildQuestionData('imageSlide', { slideImages: ['x'], timerDuration: 30 }).timerDuration).toBeUndefined();
    expect(QUESTION_TYPE_FIELDS).toContain('timerDuration');
  });
});
