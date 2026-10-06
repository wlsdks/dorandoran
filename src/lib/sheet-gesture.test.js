import { describe, expect, it } from 'vitest';
import { backdropOpacityForDrag, projectMomentum, shouldDismissSheet } from './sheet-gesture';

describe('시트 제스처 판정', () => {
  it('관성 투영은 속도에 비례하고 잘못된 입력은 0', () => {
    expect(projectMomentum(1000)).toBeCloseTo(499, 0);
    expect(projectMomentum(0)).toBe(0);
    expect(projectMomentum(NaN)).toBe(0);
    expect(projectMomentum(500, 0.99)).toBeCloseTo(49.5, 1);
  });
  it('조금만 끌고 천천히 놓으면 제자리로 돌아간다', () => {
    expect(shouldDismissSheet({ offset: 60, velocity: 50, height: 400 })).toBe(false);
  });
  it('절반 넘게 끌면 속도가 없어도 닫힌다', () => {
    expect(shouldDismissSheet({ offset: 210, velocity: 0, height: 400 })).toBe(true);
  });
  it('짧게 끌어도 빠르게 던지면 닫힌다', () => {
    expect(shouldDismissSheet({ offset: 40, velocity: 900, height: 400 })).toBe(true);
  });
  it('중간 속도는 투영 거리로 판정한다', () => {
    // 120px + 투영(≈150px) = 270 ≥ 200
    expect(shouldDismissSheet({ offset: 120, velocity: 300, height: 400 })).toBe(true);
    expect(shouldDismissSheet({ offset: 80, velocity: 150, height: 400 })).toBe(false);
  });
  it('아래로 끌었다가 위로 되돌리며 놓으면 유지한다', () => {
    expect(shouldDismissSheet({ offset: 260, velocity: -400, height: 400 })).toBe(false);
  });
  it('높이를 모르거나 위로 끌면 닫지 않는다', () => {
    expect(shouldDismissSheet({ offset: 300, velocity: 900, height: 0 })).toBe(false);
    expect(shouldDismissSheet({ offset: -20, velocity: 900, height: 400 })).toBe(false);
  });
  it('배경 어둡기는 당긴 만큼 옅어지되 바닥값을 지킨다', () => {
    expect(backdropOpacityForDrag(0, 400)).toBe(1);
    expect(backdropOpacityForDrag(200, 400)).toBeCloseTo(0.625, 3);
    expect(backdropOpacityForDrag(800, 400)).toBe(0.25);
    expect(backdropOpacityForDrag(100, 0)).toBe(1);
  });
});
