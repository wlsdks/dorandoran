import { describe, it, expect } from 'vitest';
import { SPECIAL_MODES, SPECIAL_MODE_KEYS, modeGroups, modeLabel, isSpecialMode } from './modes';

describe('특수 모드 목록', () => {
  it('모드 키가 중복되지 않는다', () => {
    expect(new Set(SPECIAL_MODE_KEYS).size).toBe(SPECIAL_MODE_KEYS.length);
  });

  it('모든 모드가 라벨과 아이콘, 그룹을 가진다', () => {
    for (const m of SPECIAL_MODES) {
      expect(m.label, m.mode).toBeTruthy();
      expect(m.icon, m.mode).toBeTruthy();
      expect(m.group, m.mode).toBeTruthy();
    }
  });

  it('추첨 계열이 모두 들어 있다 — 발표 모드에서 못 켜던 것들', () => {
    expect(SPECIAL_MODE_KEYS).toEqual(expect.arrayContaining(['lottery', 'scratchCard', 'randomPicker']));
  });

  it('랭킹는 점수가 있을 때만 메뉴에 나온다', () => {
    const without = modeGroups({ hasLeaderboard: false }).flatMap((g) => g.items).map((i) => i.mode);
    const with_ = modeGroups({ hasLeaderboard: true }).flatMap((g) => g.items).map((i) => i.mode);
    expect(without).not.toContain('leaderboard');
    expect(with_).toContain('leaderboard');
  });

  it('그룹으로 묶어도 모드가 새거나 늘지 않는다', () => {
    const grouped = modeGroups({ hasLeaderboard: true }).flatMap((g) => g.items).map((i) => i.mode);
    expect(grouped.sort()).toEqual([...SPECIAL_MODE_KEYS].sort());
  });

  it('좁은 자리에서는 짧은 이름을 쓴다', () => {
    expect(modeLabel('scratchCard')).toBe('즉석복권');
    expect(modeLabel('scratchCard', { short: true })).toBe('복권');
    expect(modeLabel('lottery', { short: true })).toBe('추첨'); // shortLabel 없으면 label
    expect(modeLabel('poll')).toBeNull();
  });

  it('질문 모드는 특수 모드가 아니다', () => {
    expect(isSpecialMode('scratchCard')).toBe(true);
    expect(isSpecialMode('poll')).toBe(false);
    expect(isSpecialMode('quiz')).toBe(false);
    expect(isSpecialMode('waiting')).toBe(false);
  });
});
