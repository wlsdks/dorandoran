import { describe, expect, it } from 'vitest';
import { DENSITY_LEVELS, denserOf, getQuestionDensity, getTextDensity } from './text-density';

const ko = n => '가'.repeat(n);

describe('getTextDensity', () => {
  it('짧은 제목과 보기 2개는 spacious', () => {
    expect(getTextDensity({ title: '점심 뭐 먹을까요?', options: ['한식', '양식'] }).level).toBe('spacious');
  });
  it('빈 입력도 안전하다', () => {
    expect(getTextDensity().level).toBe('spacious');
    expect(getTextDensity({ title: null, options: null }).level).toBe('spacious');
  });
  it('제목 길이 경계', () => {
    expect(getTextDensity({ title: ko(22) }).level).toBe('spacious');
    expect(getTextDensity({ title: ko(23) }).level).toBe('normal');
    expect(getTextDensity({ title: ko(44) }).level).toBe('normal');
    expect(getTextDensity({ title: ko(45) }).level).toBe('compact');
    expect(getTextDensity({ title: ko(72) }).level).toBe('compact');
    expect(getTextDensity({ title: ko(73) }).level).toBe('compact');
    expect(getTextDensity({ title: ko(73), options: ['가', '나'] }).level).toBe('dense');
  });
  it('보기 개수 경계', () => {
    const opts = n => Array.from({ length: n }, () => '가나');
    expect(getTextDensity({ title: '질문', options: opts(2) }).level).toBe('spacious');
    expect(getTextDensity({ title: '질문', options: opts(4) }).level).toBe('normal');
    expect(getTextDensity({ title: '질문', options: opts(5) }).level).toBe('compact');
    expect(getTextDensity({ title: '질문', options: opts(7) }).level).toBe('dense');
  });
  it('긴 보기', () => {
    expect(getTextDensity({ title: '질문', options: [ko(15), '나'] }).level).toBe('normal');
    expect(getTextDensity({ title: '질문', options: [ko(29), '나'] }).level).toBe('compact');
    expect(getTextDensity({ title: '질문', options: [ko(49), '나'] }).level).toBe('dense');
  });
  it('보기가 4개 이상이면서 길면 dense', () => {
    expect(getTextDensity({ title: '질문', options: [ko(30), ko(30), ko(30), ko(30)] }).level).toBe('dense');
  });
  it('전체 글자 수가 많으면 단계를 올린다', () => {
    expect(getTextDensity({ title: ko(10), extra: ko(180) }).level).toBe('compact');
    expect(getTextDensity({ title: ko(10), extra: ko(270) }).level).toBe('dense');
  });
  it('공백만 있는 보기는 길이로 세지 않는다', () => {
    expect(getTextDensity({ title: '질문', options: ['   '] }).longestOption).toBe(0);
  });
  it('숫자 보기도 센다', () => {
    expect(getTextDensity({ options: [12345] }).longestOption).toBe(5);
  });
  it('항상 정의된 단계만 돌려준다', () => {
    for (const t of [0, 10, 50, 100]) for (const c of [0, 2, 5, 9]) {
      expect(DENSITY_LEVELS).toContain(getTextDensity({ title: ko(t), options: Array(c).fill('가') }).level);
    }
  });
});

describe('getQuestionDensity / denserOf', () => {
  it('미스터리 박스는 후보 키워드를 본다', () => {
    expect(getQuestionDensity({ type: 'mysteryBox', title: '질문', mysteryItems: Array(8).fill('키워드') }).level).toBe('dense');
  });
  it('힌트 퀴즈는 힌트 글자를 반영한다', () => {
    expect(getQuestionDensity({ type: 'hintQuiz', title: '질문', hints: [ko(100), ko(100)] }).level).toBe('compact');
  });
  it('질문이 없으면 spacious', () => {
    expect(getQuestionDensity(null).level).toBe('spacious');
  });
  it('denserOf', () => {
    expect(denserOf('normal', 'dense')).toBe('dense');
    expect(denserOf('compact', 'spacious')).toBe('compact');
  });
});
