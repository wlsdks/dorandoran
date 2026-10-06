import { describe, expect, it } from 'vitest';
import { buildStudentRanking, myRankingSummary } from './student-ranking';

const scores = {
  a: { nickname: '민지', total: 300, quizAwards: { q1: { round: 1, points: 150 }, q2: { round: 2, points: 150 } } },
  b: { nickname: '준호', total: 150, quizAwards: { q1: { round: 1, points: 150 }, q2: { round: 2, points: 0 } } },
  c: { nickname: '서연', total: 150, quizAwards: { q1: { round: 1, points: 150 }, q2: { round: 2, points: -60 } } },
  d: { nickname: '도윤', total: 0 },
};

describe('학생 실시간 랭킹', () => {
  it('총점 순으로 정렬하고 같은 총점은 같은 순위', () => {
    const ranking = buildStudentRanking(scores);
    expect(ranking.map(r => [r.nickname, r.rank])).toEqual([['민지', 1], ['서연', 2], ['준호', 2], ['도윤', 4]]);
  });
  it('정답 수는 점수를 받은 퀴즈만 센다(0점·베팅 감점 제외)', () => {
    const byName = Object.fromEntries(buildStudentRanking(scores).map(r => [r.nickname, r]));
    expect(byName['민지']).toMatchObject({ correct: 2, answered: 2 });
    expect(byName['준호']).toMatchObject({ correct: 1, answered: 2 });
    expect(byName['서연']).toMatchObject({ correct: 1, answered: 2 });
    expect(byName['도윤']).toMatchObject({ correct: 0, answered: 0 });
  });
  it('내 순위 요약과 상위 비율', () => {
    const ranking = buildStudentRanking(scores);
    expect(myRankingSummary(ranking, 'b')).toMatchObject({ rank: 2, count: 4, topPercent: 50 });
    expect(myRankingSummary(ranking, 'nobody')).toBeNull();
    expect(buildStudentRanking(null)).toEqual([]);
  });
});
