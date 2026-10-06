import { describe, expect, it } from 'vitest';
import { groupUpdatesByQuestion } from './public-questions';

describe('공개 문항 동기화 묶음', () => {
  it('경로의 첫 칸(문항 ID)으로 묶는다', () => {
    expect(groupUpdatesByQuestion({ q1: { title: 'a' }, 'q2/title': 'b', 'q2/options': ['x'], q3: null })).toEqual({
      q1: { q1: { title: 'a' } },
      q2: { 'q2/title': 'b', 'q2/options': ['x'] },
      q3: { q3: null },
    });
  });
  it('변경이 없으면 빈 객체', () => { expect(groupUpdatesByQuestion({})).toEqual({}); });
});
