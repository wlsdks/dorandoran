import { describe, expect, it } from 'vitest';
import { stagger, reduceTo, swap, spring, grow, sheet, roll, reveal, dim, count, exitTween, ease } from './motion';

describe('stagger', () => {
  it('grows by step and stops at the cap', () => {
    expect(stagger(0)).toBe(0);
    expect(stagger(1)).toBe(0.03);
    expect(stagger(8)).toBe(0.24);
    expect(stagger(50)).toBe(0.24);
  });
  it('accepts a custom step, cap and base', () => {
    expect(stagger(3, { step: 0.05 })).toBe(0.15);
    expect(stagger(9, { step: 0.05, cap: 4 })).toBe(0.2);
    expect(stagger(2, { step: 0.1, base: 0.2 })).toBe(0.4);
  });
  it('treats bad input as the first item', () => {
    expect(stagger(-3)).toBe(0);
    expect(stagger(undefined)).toBe(0);
    expect(stagger('x')).toBe(0);
  });
});

describe('reduceTo', () => {
  const preset = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: spring.default };
  it('returns the preset untouched when motion is not reduced', () => {
    expect(reduceTo(false, preset)).toBe(preset);
  });
  it('replaces transforms with a short fade when reduced', () => {
    const r = reduceTo(true, preset);
    expect(r.initial).toEqual({ opacity: 0 });
    expect(r.animate.opacity).toBe(1);
    expect(r.animate.y).toBeUndefined();
    expect(r.exit).toEqual({ opacity: 0, transition: { duration: 0.08 } });
    expect(r.transition).toEqual({ duration: 0.08 });
  });
  it('omits exit when the preset has none', () => {
    expect(reduceTo(true, { initial: { opacity: 0 }, animate: { opacity: 1 } }).exit).toBeUndefined();
  });
});

describe('swap', () => {
  it('moves questions up, leaderboards down and stages in scale, all with the shared exit tween', () => {
    expect(swap('question').initial.y).toBe(12);
    expect(swap('question').exit.y).toBe(-8);
    expect(swap('leaderboard').initial.y).toBe(-12);
    expect(swap('stage').initial.scale).toBeCloseTo(0.985);
    expect(swap('fade').initial).toEqual({ opacity: 0 });
    for (const kind of ['question', 'leaderboard', 'stage', 'fade']) {
      expect(swap(kind).exit.transition).toBe(exitTween);
      expect(swap(kind).transition.duration).toBeLessThanOrEqual(0.4);
      expect(swap(kind).transition.ease).toBe(ease.out);
    }
  });
  it('defaults to the question swap', () => {
    expect(swap()).toEqual(swap('question'));
  });
});

describe('tokens', () => {
  it('keeps every step under the 400ms budget and bars close to critically damped', () => {
    expect(count.number.duration).toBeLessThanOrEqual(0.4);
    expect(count.score.duration).toBeLessThanOrEqual(0.6);
    expect(exitTween.duration).toBeLessThan(count.number.duration);
    const ratio = ({ stiffness, damping }) => damping / (2 * Math.sqrt(stiffness));
    expect(ratio(grow)).toBeGreaterThan(0.9);
    expect(ratio(grow)).toBeLessThan(1.1);
    expect(ratio(sheet)).toBeGreaterThan(0.85);
    expect(ratio(roll)).toBeGreaterThan(0.8);
    expect(ratio(reveal)).toBeLessThan(ratio(spring.default));
  });
  it('uses one dim level per intent', () => {
    expect(dim.option).toBe(0.55);
    expect(dim.spotlight).toBeLessThan(dim.option);
  });
});
