import { describe, expect, it } from 'vitest';
import { buildQuestionEditPatch, EDIT_LOCK_MESSAGES, questionEditLocks, validateQuestionEdit } from './question-edit';

const vote = (value) => ({ value, nickname: '학생', timestamp: 1 });
const quiz = { type: 'quiz', title: '2+2', options: ['3', '4'], correctAnswer: '4', revealedAt: 10, votes: { a: vote('4'), b: vote('3') } };
const fields = (over = {}) => ({ type: 'quiz', title: '2+2', options: ['3', '4'], correctAnswer: '4', points: 100, ...over });

describe('수업에서 쓴 문항 수정 잠금', () => {
  it('보관함 문항처럼 응답·공개 기록이 없으면 아무것도 잠기지 않는다', () => {
    const locks = questionEditLocks({ type: 'quiz', options: ['3', '4'], correctAnswer: '4' });
    expect(locks).toMatchObject({ answerLocked: false, typeLocked: false, rankingLocked: false, lockedOptions: [] });
    expect(validateQuestionEdit(null, fields({ correctAnswer: '3' }))).toBeNull();
  });

  it('정답 공개 후에는 정답을 바꿀 수 없고, 제목 수정은 된다', () => {
    expect(validateQuestionEdit(quiz, fields({ correctAnswer: '3' }))).toBe(EDIT_LOCK_MESSAGES.answer);
    expect(validateQuestionEdit(quiz, fields({ title: '2 더하기 2는?' }))).toBeNull();
    const ox = { type: 'ox', title: 'O?', correctAnswer: 'O', revealedAt: 1 };
    expect(validateQuestionEdit(ox, { type: 'ox', title: 'O?', correctAnswer: 'X' })).toBe(EDIT_LOCK_MESSAGES.answer);
    const short = { type: 'shortAnswer', title: 'q', correctAnswer: '서울', acceptableAnswers: ['Seoul'], revealedAt: 1 };
    expect(validateQuestionEdit(short, { type: 'shortAnswer', title: 'q', correctAnswer: '서울', acceptableAnswers: ['Seoul', '서울시'] })).toBe(EDIT_LOCK_MESSAGES.answer);
  });

  it('응답 받은 보기는 이름 변경·삭제가 막히고, 새 보기 추가는 된다', () => {
    const choice = { type: 'choice', title: '과일', options: ['바나나', '포도', '사과'], votes: { a: vote('바나나'), b: vote('포도') } };
    expect(questionEditLocks(choice).lockedOptions).toEqual(['바나나', '포도']);
    const f = (options) => ({ type: 'choice', title: '과일', options });
    expect(validateQuestionEdit(choice, f(['바나나', '샤인머스캣', '사과']))).toBe(EDIT_LOCK_MESSAGES.options);
    expect(validateQuestionEdit(choice, f(['바나나', '사과']))).toBe(EDIT_LOCK_MESSAGES.options);
    expect(validateQuestionEdit(choice, f(['바나나', '포도', '배', '귤']))).toBeNull();
  });

  it('응답이 있으면 유형을 바꿀 수 없다', () => {
    const choice = { type: 'choice', title: 'q', options: ['a', 'b'], votes: { a: vote('a') } };
    expect(validateQuestionEdit(choice, { type: 'wordcloud', title: 'q' })).toBe(EDIT_LOCK_MESSAGES.type);
  });

  it('순위 맞추기는 응답이 있거나 공개됐으면 항목·순서를 바꿀 수 없다', () => {
    const ranking = { type: 'ranking', title: 'r', options: ['1', '2', '3'], correctAnswer: '0,1,2', votes: { a: vote('2,0,1') } };
    const f = (options) => ({ type: 'ranking', title: 'r', options });
    expect(validateQuestionEdit(ranking, f(['2', '1', '3']))).toBe(EDIT_LOCK_MESSAGES.ranking);
    expect(validateQuestionEdit(ranking, f(['1', '2', '3']))).toBeNull();
    const revealedNoVotes = { type: 'ranking', title: 'r', options: ['1', '2', '3'], correctAnswer: '0,1,2', revealedAt: 1 };
    expect(validateQuestionEdit(revealedNoVotes, f(['3', '2', '1']))).toBe(EDIT_LOCK_MESSAGES.ranking);
  });

  it('진행 중인 힌트 퀴즈를 수정해도 공개된 힌트 수가 유지된다', () => {
    const hint = { type: 'hintQuiz', title: 'h', correctAnswer: '사과', hints: ['빨강', '과일'], revealedHints: 1 };
    const patch = buildQuestionEditPatch(hint, { type: 'hintQuiz', title: 'h 수정', correctAnswer: '사과', hints: ['빨강', '과일'] });
    expect(patch.revealedHints).toBe(1);
    expect(patch.title).toBe('h 수정');
    expect(patch).not.toHaveProperty('votes');
  });

  it('유형별로 쓰지 않는 필드는 null로 지운다', () => {
    const patch = buildQuestionEditPatch({ type: 'quiz' }, { type: 'choice', title: 'c', options: ['a', 'b'] });
    expect(patch.points).toBeNull();
    expect(patch.options).toEqual(['a', 'b']);
  });
});
