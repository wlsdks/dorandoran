import { afterEach, expect, it, vi } from 'vitest';
import { urlToInlinePart } from './bounded-image';
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it('content-length가 없어도 읽는 도중 상한을 넘으면 스트림을 닫는다', async () => {
  const cancelled = vi.fn(); let reads = 0;
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, headers: new Headers(), body: {
    getReader: () => ({ read: async () => { reads++; return { done: false, value: new Uint8Array(60) }; }, cancel: async () => cancelled(), releaseLock: vi.fn() }) } })));
  await expect(urlToInlinePart('https://image.invalid', { maxBytes: 100 })).rejects.toThrow('너무 큽니다');
  expect(reads).toBe(2); expect(cancelled).toHaveBeenCalledTimes(1);
});
it('base64 변환 중 취소하면 FileReader와 타이머도 정리한다', async () => {
  vi.useFakeTimers(); let file;
  vi.stubGlobal('FileReader', class { constructor() { file = this; } readAsDataURL() {} abort = vi.fn(); });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(10), { headers: { 'content-type': 'image/png' } })));
  const controller = new AbortController(), work = urlToInlinePart('https://image.invalid', { signal: controller.signal });
  const check = expect(work).rejects.toMatchObject({ name: 'AbortError' });
  await vi.advanceTimersByTimeAsync(0); controller.abort(); await check;
  expect(file.abort).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
});
