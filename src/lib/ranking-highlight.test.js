import { describe, expect, it } from 'vitest';
import {
  clearHighlightSpotlight, normalizeHighlightPreset, normalizeRankingHighlight, parseHighlightRanks,
  presetRankingHighlight, rankingHighlightEntry, rankingHighlightUpdates, restartHighlightPreset, revealNextHighlight,
} from './ranking-highlight';

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

describe('planned special ranks', () => {
  it('stores a plan that stays hidden from every viewer until the first reveal', () => {
    const plan = presetRankingHighlight([1, 2, 3, 27]);
    expect(plan).toEqual({ ranks: [1, 2, 3, 27], enabled: false, revealed: 0 });
    expect(normalizeRankingHighlight(plan)).toBeNull();
    expect(normalizeHighlightPreset(plan)).toEqual({ ranks: [1, 2, 3, 27], revealed: 0, activeRank: null, enabled: false });
    expect(presetRankingHighlight([])).toBeNull();
    expect(presetRankingHighlight([1, 1, 0])).toBeNull();
  });
  it('reveals the planned ranks one by one in the instructor order and stops at the end', () => {
    const first = revealNextHighlight(presetRankingHighlight([3, 1, 27]));
    expect(first).toEqual({ ranks: [3, 1, 27], activeRank: 3, enabled: true, revealed: 1 });
    expect(normalizeRankingHighlight(first).activeRank).toBe(3);
    const second = revealNextHighlight(first);
    expect(second.activeRank).toBe(1);
    expect(second.revealed).toBe(2);
    const third = revealNextHighlight(second);
    expect(third.activeRank).toBe(27);
    expect(revealNextHighlight(third)).toBeNull();
    expect(revealNextHighlight(null)).toBeNull();
  });
  it('keeps progress when the spotlight is cleared and rewinds on restart', () => {
    const shown = revealNextHighlight(revealNextHighlight(presetRankingHighlight([1, 2, 3])));
    const cleared = clearHighlightSpotlight(shown);
    expect(cleared).toEqual({ ranks: [1, 2, 3], enabled: false, revealed: 2 });
    expect(normalizeRankingHighlight(cleared)).toBeNull();
    expect(revealNextHighlight(cleared).activeRank).toBe(3);
    expect(restartHighlightPreset(shown)).toEqual({ ranks: [1, 2, 3], enabled: false, revealed: 0 });
    expect(clearHighlightSpotlight(null)).toBeNull();
    expect(restartHighlightPreset({ ranks: [] })).toBeNull();
  });
  it('writes only validated shapes and moves the board page to a revealed rank', () => {
    expect(rankingHighlightUpdates(presetRankingHighlight([1, 27]))).toEqual({ leaderboardHighlight: { ranks: [1, 27], enabled: false, revealed: 0 } });
    expect(rankingHighlightUpdates(revealNextHighlight(revealNextHighlight(presetRankingHighlight([1, 27])))))
      .toEqual({ leaderboardHighlight: { ranks: [1, 27], activeRank: 27, enabled: true, revealed: 2 }, leaderboardPage: 3 });
    expect(rankingHighlightUpdates(null)).toEqual({ leaderboardHighlight: null });
    expect(rankingHighlightUpdates({ ranks: [1], activeRank: 2, enabled: true, note: 'x' })).toEqual({ leaderboardHighlight: { ranks: [1], enabled: false, revealed: 0 } });
  });
  it('reads legacy data without a revealed field as progress up to the active rank', () => {
    const legacy = { ranks: [1, 10, 50, 200], activeRank: 50, enabled: true };
    expect(normalizeHighlightPreset(legacy)).toEqual({ ranks: [1, 10, 50, 200], revealed: 3, activeRank: 50, enabled: true });
    expect(revealNextHighlight(legacy).activeRank).toBe(200);
    expect(normalizeHighlightPreset({ ranks: [1, 2], activeRank: 2, enabled: true, revealed: 1 }).revealed).toBe(2);
    expect(normalizeHighlightPreset({ ranks: [1, 2], enabled: false, revealed: 9 }).revealed).toBe(2);
    expect(normalizeHighlightPreset({ ranks: [1, 2], enabled: false, revealed: -4 }).revealed).toBe(0);
  });
});
