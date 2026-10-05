import { realtimeSource, realtimeSnapshot, subscribeRealtime } from './realtime-store';
import { adaptiveVoteThrottle } from './realtime';

const EMPTY = Object.freeze({ votesByQuestion: Object.freeze({}), loading: false, error: null });

/** The group owns only subscriptions; the existing registry owns their SDK work and cleanup. */
export function createRevealedVotesStore(sessionId, descriptors, userId) {
  const sources = sessionId ? descriptors.map(([id, revealedAt, activatedAt]) => ({ id,
    source: realtimeSource(`sessions/${sessionId}/questions/${id}/votes`, {
      userId, scope: `revealed:${revealedAt}:round:${activatedAt || 0}`, throttleMs: adaptiveVoteThrottle,
    }) })) : [];
  let previous = [], cached = EMPTY;
  function getSnapshot() {
    if (!sources.length) return EMPTY;
    const snapshots = sources.map(({ source }) => realtimeSnapshot(source));
    if (snapshots.length === previous.length && snapshots.every((snapshot, index) => snapshot === previous[index])) return cached;
    previous = snapshots;
    cached = { votesByQuestion: Object.fromEntries(sources.map(({ id }, index) => [id, snapshots[index].value || {}])),
      loading: snapshots.some(snapshot => snapshot.loading), error: snapshots.find(snapshot => snapshot.error)?.error || null };
    return cached;
  }
  function subscribe(listener) {
    const releases = sources.map(({ source }) => subscribeRealtime(source, listener));
    let active = true;
    return () => { if (active) { active = false; releases.forEach(release => release()); } };
  }
  return { getSnapshot, subscribe };
}
