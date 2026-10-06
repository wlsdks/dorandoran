import { summarizeScores } from './classroom-data';

/**
 * 학생 화면 실시간 랭킹 — 공개 점수 노드(scores)만으로 계산한다.
 * 정답 수 = 점수가 들어온 퀴즈 영수증(quizAwards) 중 받은 점수가 0보다 큰 것.
 * 같은 총점은 같은 순위(1, 2, 2, 4…).
 */
export function buildStudentRanking(scores) {
  const sorted = summarizeScores(scores);
  let previousTotal = null;
  let previousRank = 0;
  return sorted.map((entry, index) => {
    const total = Number.isFinite(entry.total) ? entry.total : 0;
    const receipts = Object.values(entry.quizAwards || {}).filter(r => r && typeof r === 'object');
    const rank = total === previousTotal ? previousRank : index + 1;
    previousTotal = total;
    previousRank = rank;
    return {
      id: entry.id,
      nickname: entry.nickname || '익명',
      total,
      correct: receipts.filter(r => Number(r.points) > 0).length,
      answered: receipts.length,
      rank,
    };
  });
}

/** 내 위치 요약: 순위, 전체 인원, 상위 몇 %. 아직 점수 기록이 없으면 null. */
export function myRankingSummary(ranking, participantId) {
  const me = ranking.find(entry => entry.id === participantId);
  if (!me) return null;
  const topPercent = Math.max(1, Math.min(100, Math.ceil(me.rank / ranking.length * 100)));
  return { ...me, count: ranking.length, topPercent };
}
