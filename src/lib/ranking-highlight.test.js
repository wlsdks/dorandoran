import { describe, expect, it } from 'vitest';
import { nextRankingHighlight, normalizeRankingHighlight, parseHighlightRanks, rankingHighlightEntry } from './ranking-highlight';

describe('displayed ranking selection', () => {
  it('accepts commas/spaces and removes duplicates without rearranging the requested sequence', () => {
    expect(parseHighlightRanks('50, 1 10, 50 200', 200)).toEqual({ ranks: [50, 1, 10, 200] });
  });
  it.each(['', '0', '-1', '1.5', '1e2', '1, x', '9007199254740992'])('rejects invalid rank input %s', input => {
    expect(parseHighlightRanks(input, 200).error).toBeTruthy();
  });
  it('bounds the number of unique ranks and the available displayed list', () => {
    expect(parseHighlightRanks('1 2 3 4 5 6 7 8 9 10 11', 200).error).toBeTruthy();
    expect(parseHighlightRanks('201', 200).error).toBeTruthy();
    expect(parseHighlightRanks('200001', Infinity).error).toBeTruthy();
    expect(parseHighlightRanks('1 1 1 1 1 1 1 1 1 1 1', 200)).toEqual({ ranks: [1] });
  });
  it('cycles in the instructor specified order and handles a single selection', () => {
    const config = { ranks: [1, 10, 50, 200], activeRank: 200, enabled: true };
    expect(nextRankingHighlight(config).activeRank).toBe(1);
    expect(nextRankingHighlight({ ranks: [10], activeRank: 10, enabled: true }).activeRank).toBe(10);
  });
  it('fails closed for cleared, disabled or mismatched current selections', () => {
    expect(normalizeRankingHighlight(null)).toBeNull();
    expect(normalizeRankingHighlight({ ranks: [1], activeRank: 1, enabled: false })).toBeNull();
    expect(normalizeRankingHighlight({ ranks: [1], activeRank: 2, enabled: true })).toBeNull();
    const sparseRanks = Array(3);
    sparseRanks[0] = 1; sparseRanks[2] = 3;
    expect(normalizeRankingHighlight({ ranks: sparseRanks, activeRank: 1, enabled: true })).toBeNull();
    expect(normalizeRankingHighlight({ ranks: [200001], activeRank: 200001, enabled: true })).toBeNull();
  });
  it('highlights the current occupant of a displayed position without changing score or tie ordering', () => {
    const original = [{ id: 'a', total: 100 }, { id: 'b', total: 100 }, { id: 'c', total: 90 }];
    const config = { ranks: [2], activeRank: 2, enabled: true };
    expect(rankingHighlightEntry(original, config).id).toBe('b');
    const updated = [original[2], original[0], original[1]];
    expect(rankingHighlightEntry(updated, config).id).toBe('a');
    expect(original.map(entry => entry.id)).toEqual(['a', 'b', 'c']);
    expect(rankingHighlightEntry([], config)).toBeNull();
  });
});
