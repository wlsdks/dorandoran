import { useEffect, useMemo, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from '@/lib/firebase';

/** 세션 메타만 개별 구독한다. 큰 참가자/채팅 트리를 함께 내려받지 않는다. */
export function useRealtimeRecord(path, keys, select) {
  const source = useMemo(() => ({ path, keys, select }), [path, keys, select]);
  const [snapshot, setSnapshot] = useState(null);
  useEffect(() => {
    if (!source.path) return;
    let active = true;
    let value = {};
    const received = new Set();
    const errors = new Map();
    const publish = () => setSnapshot({ source, value, loading: received.size < keys.length && errors.size === 0,
      error: errors.values().next().value || null });
    const unsubs = keys.map((key) => onValue(ref(db, `${source.path}/${key}`), (snap) => {
      if (!active) return;
      const raw = snap.val();
      const next = source.select?.[key] ? source.select[key](raw) : raw;
      if (received.has(key) && Object.is(value[key], next) && !errors.has(key)) return;
      received.add(key);
      errors.delete(key);
      value = { ...value, [key]: next };
      publish();
    }, (error) => { if (active) { errors.set(key, error); publish(); } }));
    return () => { active = false; unsubs.forEach((unsub) => unsub()); };
  }, [source, keys]);
  const current = snapshot?.source === source ? snapshot : null;
  return { value: current?.error ? null : current?.value ?? null, loading: Boolean(path && (!current || current.loading)), error: current?.error ?? null };
}
