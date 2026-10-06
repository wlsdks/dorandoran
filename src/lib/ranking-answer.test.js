import { describe, expect, it } from 'vitest';
import {
  parseRankingOrder, serializeRankingOrder, correctRankingOrder, normalizeRankingAnswer, isCompleteRankingOrder,
  removeRankingItem, rankingCircled, rankingOrdinal, formatRankingSequence, rankingPositionHits, rankingPositionStats,
} from './ranking-answer';

const options = ['DNS 조회', '렌더링', '요청 전송', '응답 생성'];

describe('순위 맞추기 정답 순서 읽기·쓰기', () => {
  it('번호 순서 문자열과 배열을 읽고, 항목을 한 번씩 담지 않으면 거부한다', () => {
    expect(parseRankingOrder('0,2,3,1', 4)).toEqual([0, 2, 3, 1]);
    expect(parseRankingOrder([0, 2, 3, 1], 4)).toEqual([0, 2, 3, 1]);
    expect(parseRankingOrder(' 1 , 0 ', 2)).toEqual([1, 0]);
    for (const bad of ['0,2,3', '0,2,3,1,1', '0,0,1,2', '0,2,3,4', '0,2,a,1', '', null, undefined, [0, 2, '3', 1.5]]) {
      expect(parseRankingOrder(bad, 4)).toBeNull();
    }
    expect(parseRankingOrder('0,1', 0)).toBeNull();
    expect(serializeRankingOrder([0, 2, 3, 1])).toBe('0,2,3,1');
  });
  it('예전 문항(저장 순서 = 정답)과 빈 정답은 저장 순서를 정답으로 읽는다', () => {
    expect(correctRankingOrder(options, '0,1,2,3')).toEqual([0, 1, 2, 3]);
    expect(correctRankingOrder(options, undefined)).toEqual([0, 1, 2, 3]);
    expect(correctRankingOrder(options, '0,2,3,1')).toEqual([0, 2, 3, 1]);
    expect(normalizeRankingAnswer([0, 2, 3, 1], 4)).toBe('0,2,3,1');
    expect(normalizeRankingAnswer('2,0', 3)).toBe('0,1,2');
  });
  it('정답 순서 편집: 완성 여부와 항목 삭제 후 번호 당김', () => {
    expect(isCompleteRankingOrder([0, 2, 3, 1], 4)).toBe(true);
    expect(isCompleteRankingOrder([0, 2], 4)).toBe(false);
    expect(removeRankingItem([0, 2, 3, 1], 2)).toEqual([0, 2, 1]);
    expect(removeRankingItem([3, 1], 0)).toEqual([2, 0]);
    expect(removeRankingItem(undefined, 0)).toEqual([]);
  });
  it('번호·자리 이름·순서 문구', () => {
    expect(rankingCircled(0)).toBe('①');
    expect(rankingCircled(10)).toBe('11.');
    expect(rankingOrdinal(0)).toBe('첫 번째');
    expect(rankingOrdinal(3)).toBe('네 번째');
    expect(formatRankingSequence([0, 2, 3, 1])).toBe('1 → 3 → 4 → 2');
    expect(formatRankingSequence([0, 2, 3, 1], { circled: true })).toBe('① → ③ → ④ → ②');
    expect(formatRankingSequence([0, 2], { circled: true, options })).toBe('① DNS 조회 → ③ 요청 전송');
  });
});

describe('순위 맞추기 집계', () => {
  const correct = [0, 2, 3, 1];
  it('자리별 맞힌 여부는 정답 번호 순서를 기준으로 본다', () => {
    expect(rankingPositionHits(correct, [0, 2, 1, 3])).toEqual([true, true, false, false]);
    expect(rankingPositionHits(correct, null)).toEqual([null, null, null, null]);
  });
  it('응답이 없어도 정답 순서 행이 나오고, 전부 맞힌 수는 완전 일치만 센다', () => {
    const empty = rankingPositionStats({}, correct);
    expect(empty.totalVoters).toBe(0);
    expect(empty.perfectCount).toBe(0);
    expect(empty.positions.map((p) => p.itemIndex)).toEqual(correct);
    expect(empty.positions.every((p) => p.correct === 0 && p.pct === 0)).toBe(true);
    const stats = rankingPositionStats({
      a: { value: '0,2,3,1' }, b: { value: '0,2,1,3' }, c: { value: '1,0,2,3' }, broken: { value: '0,0,0,0' }, missing: {},
    }, correct);
    expect(stats.totalVoters).toBe(3);
    expect(stats.perfectCount).toBe(1);
    expect(stats.positions.map((p) => p.correct)).toEqual([2, 2, 1, 1]);
    expect(stats.positions.map((p) => p.pct)).toEqual([67, 67, 33, 33]);
  });
});
