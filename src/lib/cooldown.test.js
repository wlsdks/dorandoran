import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCooldown } from './cooldown';

afterEach(() => vi.useRealTimers());
describe('전송 중복과 종료된 화면', () => {
  it('요청이 완료되기 전부터 중복 전송을 차단한다', () => {
    vi.useFakeTimers(); const gate = createCooldown(2000); const attempt = gate.begin();
    expect(gate.begin()).toBeNull(); expect(gate.getSnapshot()).toBe(false);
    expect(gate.finish(attempt)).toBe(true); vi.advanceTimersByTime(1999); expect(gate.begin()).toBeNull();
    vi.advanceTimersByTime(1); expect(gate.begin()).not.toBeNull();
    gate.dispose(); expect(vi.getTimerCount()).toBe(0);
  });
  it('세션이 종료된 후 도착한 완료 응답은 새 타이머를 만들지 못한다', () => {
    vi.useFakeTimers(); const gate = createCooldown(2000); const attempt = gate.begin(); gate.dispose();
    expect(gate.finish(attempt)).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });
  it('StrictMode의 정리/재시작 뒤에도 이전 요청은 새 요청을 풀지 못한다', () => {
    vi.useFakeTimers(); const gate = createCooldown(2000); const old = gate.begin(); gate.dispose(); gate.activate();
    const next = gate.begin(); gate.fail(old); expect(gate.getSnapshot()).toBe(false);
    gate.fail(next); expect(gate.getSnapshot()).toBe(true);
  });
});
