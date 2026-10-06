import { describe, expect, it } from 'vitest';
import { breakEndsAt, breakState, clampBreakMinutes, formatClock, formatRemaining, normalizeBreakLabel, normalizeBreakStyle } from './break-time';

const at = (h, m, s = 0) => Date.UTC(2026, 9, 6, h, m, s);

describe('쉬는 시간 계산', () => {
  it('카운트다운은 지금부터 정확히 N분 뒤에 끝난다', () => {
    expect(breakEndsAt(at(12, 29, 42), 10, 'countdown')).toBe(at(12, 39, 42));
  });
  it('시작 시각 표시는 분 단위로 올려 딱 떨어지는 시각을 보여준다', () => {
    expect(breakEndsAt(at(12, 29, 42), 10, 'startAt')).toBe(at(12, 40));
    expect(breakEndsAt(at(12, 30, 0), 10, 'startAt')).toBe(at(12, 40));
    expect(formatClock(at(12, 40), 'UTC')).toBe('12:40');
    expect(formatClock(at(21, 5), 'UTC')).toBe('21:05');
    expect(formatClock(at(0, 7), 'UTC')).toBe('00:07');
  });
  it('남은 시간은 MM:SS, 1시간 이상은 H:MM:SS', () => {
    expect(formatRemaining(599)).toBe('09:59');
    expect(formatRemaining(3725)).toBe('1:02:05');
    expect(formatRemaining(-3)).toBe('00:00');
  });
  it('상태: 없음 → 진행 중 → 끝', () => {
    expect(breakState({}, at(12, 0)).phase).toBe('idle');
    const running = breakState({ endsAt: at(12, 10), style: 'startAt', label: '대기 시간' }, at(12, 9, 30));
    expect(running).toMatchObject({ phase: 'running', remaining: 30, label: '대기 시간', style: 'startAt' });
    expect(breakState({ endsAt: at(12, 10) }, at(12, 11)).phase).toBe('finished');
  });
  it('예전 데이터·잘못된 값은 쉬는 시간 + 카운트다운으로 읽는다', () => {
    expect(normalizeBreakLabel(undefined)).toBe('쉬는 시간');
    expect(normalizeBreakLabel('점심')).toBe('쉬는 시간');
    expect(normalizeBreakStyle(null)).toBe('countdown');
  });
  it('직접 입력 분은 1~180 정수만', () => {
    expect(clampBreakMinutes('12')).toBe(12);
    expect(clampBreakMinutes(0)).toBeNull();
    expect(clampBreakMinutes('')).toBeNull();
    expect(clampBreakMinutes('abc')).toBeNull();
    expect(clampBreakMinutes(500)).toBe(180);
    expect(clampBreakMinutes(7.6)).toBe(8);
  });
});
