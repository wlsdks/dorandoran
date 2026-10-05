import { limitToLast, onValue, query, ref } from 'firebase/database';
import { db } from './firebase';

const stores = new Map();
const identities = new WeakMap();
let identity = 0;
const EMPTY = Object.freeze({ value: null, loading: false, error: null });
const INITIAL = Object.freeze({ value: null, loading: true, error: null });
function keyPart(value) {
  if ((typeof value === 'object' && value !== null) || typeof value === 'function') {
    if (!identities.has(value)) identities.set(value, ++identity);
    return `ref:${identities.get(value)}`;
  }
  if (typeof value === 'symbol') return `symbol:${++identity}`;
  return `${typeof value}:${String(value)}`;
}

export function realtimeSource(path, { limit, scope, select, throttleMs = 0, userId } = {}) {
  return { path, limit, scope, select, throttleMs, key: JSON.stringify([userId, path, limit, scope, select, throttleMs].map(keyPart)) };
}

export function realtimeSnapshot(source) {
  return source.path ? stores.get(source.key)?.snapshot || INITIAL : EMPTY;
}

/** 동일 사용자/쿼리는 한 번만 계산한다. 마지막 소비자가 나가면 SDK 구독·flush·값을 회수한다. */
export function subscribeRealtime(source, listener) {
  if (!source.path) return () => {};
  let store = stores.get(source.key);
  if (!store) {
    store = { snapshot: INITIAL, listeners: new Set(), active: true, timer: null, pending: null, off: null, started: false };
    stores.set(source.key, store);
  }
  store.listeners.add(listener);
  if (!store.started) {
    store.started = true;
    const notify = () => store.listeners.forEach(callback => callback());
    const commit = snapshot => {
      if (!store.active) return;
      try {
        const raw = snapshot.val();
        const value = source.select ? source.select(raw) : raw;
        if (!store.snapshot.loading && !store.snapshot.error && Object.is(value, store.snapshot.value)) return;
        store.snapshot = { value, loading: false, error: null };
      } catch (error) { store.snapshot = { value: null, loading: false, error }; }
      notify();
    };
    const failure = error => {
      if (!store.active) return;
      clearTimeout(store.timer); store.timer = null; store.pending = null;
      store.snapshot = { value: null, loading: false, error }; notify();
    };
    try {
      const target = ref(db, source.path);
      const subscription = source.limit ? query(target, limitToLast(source.limit)) : target;
      store.off = onValue(subscription, snapshot => {
        if (!store.active) return;
        if (store.snapshot.loading || !source.throttleMs) { commit(snapshot); return; }
        store.pending = snapshot;
        if (store.timer !== null) return;
        const delay = typeof source.throttleMs === 'function' ? source.throttleMs(snapshot.size) : source.throttleMs;
        if (!delay) { store.pending = null; commit(snapshot); return; }
        store.timer = setTimeout(() => {
          store.timer = null; const latest = store.pending; store.pending = null;
          if (latest) commit(latest);
        }, delay);
      }, failure);
    } catch (error) { store.off = () => {}; failure(error); }
  }
  let subscribed = true;
  return () => {
    if (!subscribed) return;
    subscribed = false; store.listeners.delete(listener);
    if (store.listeners.size) return;
    store.active = false; store.off?.(); clearTimeout(store.timer);
    store.pending = null; store.snapshot = EMPTY;
    stores.delete(source.key);
  };
}
