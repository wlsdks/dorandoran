import { describe, expect, it } from 'vitest';
import { QUESTION_TYPES } from './question-types';
import { isResponseQuestion, questionParticipationKind, questionResponseState, summarizeParticipantResponses } from './response-questions';

describe('response participation', () => {
  it('keeps every current vote activity and distinguishes materials, modes and submissions', () => {
    const nonVoting = new Set(['imageSlide', 'webEmbed', 'aiJudge']);
    for (const { value } of QUESTION_TYPES) {
      expect(isResponseQuestion({ type: value })).toBe(!nonVoting.has(value));
    }
    expect(questionParticipationKind({ type: 'modeCard' })).toBe('mode');
    expect(questionParticipationKind({ type: 'imageSlide' })).toBe('material');
    expect(questionParticipationKind({ type: 'aiJudge' })).toBe('submission');
    expect(questionParticipationKind({ type: 'unsupported' })).toBe('unknown');
  });

  it('does not penalize materials or inflate participation from their obsolete votes', () => {
    const questions = {
      answer: { type: 'choice', votes: { learner: { value: 'A' } } },
      quiz: { type: 'quiz', correctAnswer: 'A' },
      slide: { type: 'imageSlide', votes: { learner: { value: 'old' } } },
      web: { type: 'webEmbed' },
      game: { type: 'modeCard', mode: 'lottery' },
      work: { type: 'aiJudge', submissions: { learner: { title: 'My work' } } },
    };
    expect(summarizeParticipantResponses(questions, 'learner')).toEqual({ answeredCount: 1, totalQuestions: 2, correctCount: 0, gradableCount: 0 });
    expect(questionResponseState(questions.slide, 'learner')).toMatchObject({ participationKind: 'material', answered: false, myAnswer: null, isCorrect: null });
    expect(questionResponseState(questions.work, 'learner')).toMatchObject({ participationKind: 'submission', answered: false, isCorrect: null });
  });

  it('retains legacy response questions without activation metadata in the denominator', () => {
    expect(summarizeParticipantResponses({ legacy: { type: 'quiz' }, configured: { type: 'choice', activatedAt: 0 } }, 'learner').totalQuestions).toBe(2);
  });

  it('distinguishes unanswered, incorrect, correct and an unrevealed answer key', () => {
    const question = { type: 'quiz', correctAnswer: 'B', votes: { wrong: { value: 'A' }, right: { value: 'B' } } };
    expect(questionResponseState(question, 'absent').isCorrect).toBeNull();
    expect(questionResponseState(question, 'wrong').isCorrect).toBe(false);
    expect(questionResponseState(question, 'right').isCorrect).toBe(true);
    expect(questionResponseState({ ...question, correctAnswer: null }, 'right').isCorrect).toBeNull();
  });

  it('grades only submitted answers using accepted text variants without changing the data', () => {
    const questions = {
      typed: { type: 'shortAnswer', correctAnswer: 'Team work', acceptableAnswers: ['협업'], points: 120, votes: { learner: { value: ' TEAM WORK ' } } },
      wrong: { type: 'quiz', correctAnswer: 'B', votes: { learner: { value: 'A' } } },
      absent: { type: 'quiz', correctAnswer: 'A' },
    };
    const before = structuredClone(questions);
    expect(summarizeParticipantResponses(questions, 'learner')).toEqual({ answeredCount: 2, totalQuestions: 3, correctCount: 1, gradableCount: 2 });
    expect(questions).toEqual(before);
  });

  it('preserves a legitimate zero response rather than displaying it as missing', () => {
    expect(questionResponseState({ type: 'scale', votes: { learner: { value: 0 } } }, 'learner')).toMatchObject({ answered: true, myAnswer: 0, isCorrect: null });
  });
});
