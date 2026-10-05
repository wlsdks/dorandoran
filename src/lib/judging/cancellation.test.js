import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ generate: vi.fn(), image: vi.fn() }));
vi.mock('@/lib/gemini/client', () => ({ getGeminiModel: () => ({ generateContent: mocks.generate }), isGeminiConfigured: () => true }));
vi.mock('@/lib/bounded-image', () => ({ urlToInlinePart: mocks.image }));
import { judgeSubmission, withRetry } from './gemini';
import { judgeLiveSubmission } from './geminiLive';
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

it('과제 7판사는 같은 이미지를 한 번만 다운로드한다', async () => {
  mocks.image.mockResolvedValue({ inlineData: { mimeType: 'image/png', data: 'abc=' } });
  mocks.generate.mockResolvedValue({ response: { text: () => JSON.stringify({ score: 8, selected: true }) } });
  const result = await judgeSubmission({ screenshots: [{ url: 'https://image.invalid' }] });
  expect(mocks.image).toHaveBeenCalledTimes(1); expect(mocks.generate).toHaveBeenCalledTimes(7);
  expect(result.summary.totalJudges).toBe(7);
});
it('재시도 대기 중 취소하면 더 호출하지 않고 타이머를 회수한다', async () => {
  vi.useFakeTimers(); const controller = new AbortController(), request = vi.fn().mockRejectedValue(new Error('503'));
  const work = withRetry(request, 4, 2000, 45000, { signal: controller.signal });
  const check = expect(work).rejects.toMatchObject({ name: 'AbortError' });
  await vi.advanceTimersByTimeAsync(0); controller.abort(); await check;
  expect(request).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
});
it('라이브 심사 취소는 실제 전송 신호와 연출 지연을 중단한다', async () => {
  vi.useFakeTimers(); const controller = new AbortController(), started = vi.fn(), completed = vi.fn();
  let requestSignal;
  mocks.generate.mockImplementation((_payload, options) => { requestSignal = options.signal;
    return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })); });
  const work = judgeLiveSubmission({ title: '실습' }, '수업', completed, started, { signal: controller.signal });
  const check = expect(work).rejects.toMatchObject({ name: 'AbortError' });
  await vi.advanceTimersByTimeAsync(0); expect(started).toHaveBeenCalledTimes(1);
  controller.abort(); await check; await vi.advanceTimersByTimeAsync(100000);
  expect(requestSignal.aborted).toBe(true); expect(completed).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});
