import { describe, expect, it } from 'vitest';
import { applyQuizScoreAwards, hasQuizRoundReceipt, quizAwardRollbackUpdates, scoreNickname } from './quiz-awards';

describe('응답 초기화 시 퀴즈 점수 되돌리기', () => {
  it('이 문항 영수증이 있는 참여자만 점수를 빼고 영수증을 지운다', () => {
    const scores = {
      a: { nickname: 'A', total: 245, lastQuestionId: 'q1', lastPoints: 145, quizAwards: { q0: { round: 1, points: 100 }, q1: { round: 2, points: 145 } } },
      b: { nickname: 'B', total: 50, quizAwards: { q0: { round: 1, points: 50 } } },
      c: { nickname: 'C', total: 0, quizAwards: { q1: { round: 2, points: 0 } } },
    };
    expect(quizAwardRollbackUpdates(scores, 'q1')).toEqual({
      'scores/a/total': 100, 'scores/a/quizAwards/q1': null, 'scores/a/lastPoints': 0,
      'scores/c/total': 0, 'scores/c/quizAwards/q1': null,
    });
    expect(quizAwardRollbackUpdates(null, 'q1')).toEqual({});
  });
});
import { getQuizReward } from './quiz';

const question = { type: 'quiz', correctAnswer: 'A', activatedAt: 1000, event: 'double-points', betting: true,
  votes: { learner: { value: 'A', bet: '3', timestamp: 1000, nickname: '원래학생' } } };

describe('원자적 퀴즈 지급 receipt', () => {
  it('최신 점수에 보상·콤보·연속정답·receipt를 한 번에 적용하고 원본을 보존한다', () => {
    const previous = { learner: { nickname: '이전학생', total: 90, streak: 2, bestStreak: 7, customLegacyField: 'keep', quizAwards: { earlier: { round: 50, points: 30 } } }, other: { nickname: '다른학생', total: 12 } };
    const original = structuredClone(previous);
    const result = applyQuizScoreAwards(previous, question, 'q1', 2000, { learner: { nickname: '기존에 길게 저장되어 있던 이름' } }, true);
    const points = getQuizReward(question, question.votes.learner).points * 1.2;
    expect(result.learner).toMatchObject({ total: 90 + points, lastPoints: points, streak: 3, bestStreak: 7, customLegacyField: 'keep', quizAwards: { q1: { round: 2000, points }, earlier: { round: 50, points: 30 } } });
    expect(result.learner.nickname.length).toBeLessThanOrEqual(10);
    expect(result.other).toBe(previous.other);
    expect(previous).toEqual(original);
  });
  it('같은 round 재시도는 점수·lastPoints·streak를 다시 바꾸지 않는다', () => {
    const awarded = applyQuizScoreAwards({}, question, 'q1', 2000);
    const nextQuestionScore = { ...awarded, learner: { ...awarded.learner, lastPoints: 30, lastQuestionId: 'q2' } };
    expect(applyQuizScoreAwards(nextQuestionScore, question, 'q1', 2000)).toEqual(nextQuestionScore);
  });
  it('새 round만 다시 지급하고 receipt는 질문마다 최신 하나만 남는다', () => {
    let scores = {};
    for (let round = 2000; round < 2020; round++) scores = applyQuizScoreAwards(scores, question, 'q1', round);
    expect(scores.learner.total).toBe(20 * getQuizReward(question, question.votes.learner).points);
    expect(Object.keys(scores.learner.quizAwards)).toEqual(['q1']);
    expect(hasQuizRoundReceipt(scores.learner, 'q1', 2019)).toBe(true);
    expect(hasQuizRoundReceipt(scores.learner, 'q1', 2000)).toBe(false);
  });
  it('오답 베팅 패널티·연속정답 초기화도 중복 지급하지 않는다', () => {
    const wrong = { ...question, votes: { learner: { value: 'B', bet: '2', timestamp: 1000 } } };
    const score = applyQuizScoreAwards({ learner: { nickname: '학생', total: 100, streak: 8, bestStreak: 8 } }, wrong, 'q1', 2000, {}, true);
    expect(score.learner).toMatchObject({ total: 70, lastPoints: -30, streak: 0, bestStreak: 8 });
    expect(applyQuizScoreAwards(score, wrong, 'q1', 2000, {}, true)).toEqual(score);
  });
  it('사번/레거시 ID가 prototype 이름이어도 안전하게 원래 ID를 유지한다', () => {
    const votes = JSON.parse('{"__proto__":{"value":"A","timestamp":1000,"nickname":"학생"}}');
    const result = applyQuizScoreAwards({}, { ...question, votes }, 'constructor', 2000);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.hasOwn(result, '__proto__')).toBe(true);
    expect(result.__proto__.quizAwards.constructor.round).toBe(2000);
    expect({}.total).toBeUndefined();
  });
  it('닉네임 제한은 원본을 바꾸지 않고 UTF16 surrogate를 자르지 않는다', () => {
    expect(scoreNickname('😀'.repeat(8))).toBe('😀'.repeat(5));
    expect(scoreNickname('   ')).toBe('참여자');
  });
});
