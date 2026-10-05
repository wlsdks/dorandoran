import { afterEach, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({ registrations: [] }));
vi.mock('./firebase', () => ({ db: {} }));
vi.mock('firebase/database', () => ({ ref: (_, path) => path, limitToLast: value => value, query: (path, limit) => `${path}:${limit}`,
  onValue: (path, next, fail) => { const off = vi.fn(); sdk.registrations.push({ path, next, fail, off }); return off; } }));
import { realtimeSource, realtimeSnapshot, subscribeRealtime } from './realtime-store';
afterEach(() => { sdk.registrations.length = 0; vi.useRealTimers(); });

it('세 소비자가 같은 쿼리를 공유하고 마지막 해제 때만 닫는다', () => {
  const source = realtimeSource('shared', { userId: 'alice' }), listeners = [vi.fn(), vi.fn(), vi.fn()];
  const releases = listeners.map(listener => subscribeRealtime(source, listener));
  expect(sdk.registrations).toHaveLength(1);
  const val = vi.fn(() => ({ count: 200 })); sdk.registrations[0].next({ val });
  expect(val).toHaveBeenCalledTimes(1); listeners.forEach(listener => expect(listener).toHaveBeenCalledTimes(1));
  releases[0](); releases[0](); releases[1](); expect(sdk.registrations[0].off).not.toHaveBeenCalled();
  releases[2](); expect(sdk.registrations[0].off).toHaveBeenCalledTimes(1);
  expect(realtimeSnapshot(source).value).toBeNull();
});
it('로그인·회차·쿼리 제한이 다르면 스냅샷을 공유하지 않는다', () => {
  const sources = [realtimeSource('private', { userId: 'a', scope: 1 }), realtimeSource('private', { userId: 'b', scope: 1 }), realtimeSource('private', { userId: 'a', scope: 2 }), realtimeSource('private', { userId: 'a', scope: 1, limit: 5 })];
  const off = sources.map(source => subscribeRealtime(source, () => {}));
  sdk.registrations[0].next({ val: () => 'a-only' });
  expect(realtimeSnapshot(sources[1]).value).toBeNull(); expect(sdk.registrations).toHaveLength(4);
  off.forEach(stop => stop());
});
it('해제된 구독과 지연 flush는 새 구독에 늦은 데이터를 전달하지 않는다', async () => {
  vi.useFakeTimers(); const source = realtimeSource('throttled', { throttleMs: 150 });
  const off = subscribeRealtime(source, () => {}), old = sdk.registrations[0];
  old.next({ val: () => 'initial' }); old.next({ val: () => 'late' }); off();
  const stop = subscribeRealtime(source, () => {}); old.next({ val: () => 'stale' });
  await vi.advanceTimersByTimeAsync(200); expect(realtimeSnapshot(source).value).toBeNull();
  expect(vi.getTimerCount()).toBe(0); stop();
});
