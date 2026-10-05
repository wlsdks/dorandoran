import { afterEach, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({ registrations: [] }));
vi.mock('./firebase', () => ({ db: {} }));
vi.mock('firebase/database', () => ({ ref: (_, path) => path, limitToLast: value => value, query: path => path,
  onValue: (path, next, fail) => { const off = vi.fn(); sdk.registrations.push({ path, next, fail, off }); return off; } }));
import { createRevealedVotesStore } from './revealed-votes-store';
afterEach(() => { sdk.registrations.length = 0; });
it('waits for every eligible query and exposes permission failure instead of an empty result', () => {
  const group = createRevealedVotesStore('sid', [['q1', 10, 2], ['q2', 11, 3]], 'viewer');
  const off = group.subscribe(() => {}); expect(group.getSnapshot().loading).toBe(true);
  sdk.registrations[0].next({ val: () => ({ a: { value: 'A' } }) }); expect(group.getSnapshot().loading).toBe(true);
  const error = new Error('permission denied'); sdk.registrations[1].fail(error);
  expect(group.getSnapshot().error).toBe(error); expect(group.getSnapshot().loading).toBe(false); off();
});
it('shares identical groups and releases only the final consumer; late callbacks cannot cross a new epoch', () => {
  const first = createRevealedVotesStore('sid', [['q', 10, 2]], 'viewer'), second = createRevealedVotesStore('sid', [['q', 10, 2]], 'viewer');
  const off1 = first.subscribe(() => {}), off2 = second.subscribe(() => {}); expect(sdk.registrations).toHaveLength(1);
  const old = sdk.registrations[0]; old.next({ val: () => ({ a: { value: 'A' } }) });
  expect(second.getSnapshot().votesByQuestion.q.a.value).toBe('A'); off1(); expect(old.off).not.toHaveBeenCalled(); off2(); off2(); expect(old.off).toHaveBeenCalledTimes(1);
  const next = createRevealedVotesStore('sid', [['q', 20, 3]], 'viewer'), stop = next.subscribe(() => {});
  old.next({ val: () => ({ stale: { value: 'secret' } }) }); expect(next.getSnapshot().loading).toBe(true); expect(next.getSnapshot().votesByQuestion.q).toEqual({}); stop();
});
