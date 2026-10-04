import { useEffect, useMemo, useState } from 'react';
import { limitToLast, onValue, query, ref } from 'firebase/database';
import { db } from '@/lib/firebase';

/** 경로가 바뀐 첫 렌더부터 이전 값을 숨기고, 해제된 구독의 응답은 버린다. */
export function useRealtimeValue(path, { limit, scope, select, throttleMs = 0 } = {}) {
  const source = useMemo(() => ({ path, limit, scope, select, throttleMs }), [path, limit, scope, select, throttleMs]);
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    if (!source.path) return;
    let active = true;
    let timer = null;
    let pending = null;
    let first = true;
    const commit = (snap) => {
      if (!active) return;
      const raw = snap.val();
      const value = source.select ? source.select(raw) : raw;
      setSnapshot((previous) => previous?.source === source && !previous.error && Object.is(previous.value, value)
        ? previous : { source, value, error: null });
    };
    const target = ref(db, source.path);
    const subscription = source.limit ? query(target, limitToLast(source.limit)) : target;
    const unsubscribe = onValue(subscription, (snap) => {
      if (!active) return;
      if (first || !source.throttleMs) {
        first = false;
        commit(snap);
        return;
      }
      // 최신 스냅샷을 한 번만 계산한다. 연속 이벤트가 와도 flush를 취소하지 않는다.
      pending = snap;
      if (timer === null) {
        const delay = typeof source.throttleMs === 'function' ? source.throttleMs(snap.size) : source.throttleMs;
        if (!delay) { pending = null; commit(snap); return; }
        timer = setTimeout(() => { timer = null; const latest = pending; pending = null; if (latest) commit(latest); }, delay);
      }
    }, (error) => {
      if (!active) return;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      pending = null;
      setSnapshot({ source, value: null, error });
    });
    return () => {
      active = false;
      unsubscribe();
      if (timer !== null) clearTimeout(timer);
      pending = null;
    };
  }, [source]);

  const current = snapshot?.source === source ? snapshot : null;
  return { value: current?.value ?? null, loading: Boolean(path && !current), error: current?.error ?? null };
}
