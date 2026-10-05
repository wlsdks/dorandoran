import { afterEach, describe, expect, it, vi } from 'vitest';
import { withDeadline, abortableDelay } from './async-work';

afterEach(() => vi.useRealTimers());
describe('요청 생명주기', () => {
  it('수백 번 빠르게 완료해도 타임아웃 타이머를 남기지 않는다', async () => {
    vi.useFakeTimers();
    for (let i = 0; i < 500; i++) expect(await withDeadline(() => i, 45000)).toBe(i);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('deadline 초과는 작업에 abort를 전달하고 타이머를 회수한다', async () => {
    vi.useFakeTimers(); let received;
    const result = withDeadline(signal => { received = signal; return new Promise(() => {}); }, 30, { message: '제한 초과' });
    const checked = expect(result).rejects.toThrow('제한 초과');
    await vi.advanceTimersByTimeAsync(30); await checked;
    expect(received.aborted).toBe(true); expect(vi.getTimerCount()).toBe(0);
  });
  it('상위 취소는 진행 중 요청과 재시도 대기를 즉시 종료한다', async () => {
    vi.useFakeTimers(); const controller = new AbortController();
    const first = withDeadline(signal => abortableDelay(20000, signal), 45000, { signal: controller.signal });
    const checked = expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await Promise.resolve(); controller.abort(); await checked;
    expect(vi.getTimerCount()).toBe(0);
  });
});
