import { expect, it } from 'vitest';
import { answerRanking, revealedQuestionEntries } from './revealed-ranking';
it('only publicly answered and revealed metadata is eligible, without requiring embedded votes', () => {
  const questions = { revealed: { type: 'quiz', correctAnswer: 'A', revealedAt: 10 }, hidden: { type: 'quiz', revealedAt: 10 }, pending: { type: 'quiz', correctAnswer: 'secret' } };
  expect(revealedQuestionEntries(questions).map(([id]) => id)).toEqual(['revealed']);
});
it('keeps positive-correct filtering and fewer-attempts tie breaks, while counting wrong-only respondents honestly', () => {
  const questions = { one: { type: 'quiz', correctAnswer: 'A', revealedAt: 1 }, two: { type: 'quiz', correctAnswer: 'B', revealedAt: 2 } };
  const result = answerRanking(questions, { one: { a: { nickname: '가', value: 'A' }, b: { nickname: '나', value: 'C' }, c: { nickname: '다', value: 'A' }, d: { nickname: '라', value: 'A' } },
    two: { a: { value: 'B' }, b: { value: 'C' }, c: { value: 'C' } } });
  expect(result.respondentCount).toBe(4); expect(result.totalQuestions).toBe(2);
  expect(result.ranking.map(entry => [entry.id, entry.correct, entry.answered, entry.rank])).toEqual([['a', 2, 2, 1], ['d', 1, 1, 2], ['c', 1, 2, 3]]);
});
