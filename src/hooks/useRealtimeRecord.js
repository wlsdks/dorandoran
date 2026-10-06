import { useEffect, useMemo, useState } from 'react';
import { auth } from '@/lib/auth-session';
import { realtimeSource, realtimeSnapshot, subscribeRealtime } from '@/lib/realtime-store';

/**
 * 세션 메타만 개별 구독한다. 큰 참가자/채팅 트리를 함께 내려받지 않는다.
 * throttle: { [key]: ms } — 투표가 몰리는 큰 칸(예: 강사 화면의 questions)은 화면 갱신을 묶어 CPU를 아낀다.
 */
export function useRealtimeRecord(path, keys, select, throttle) {
  const userId = auth.currentUser?.uid;
  const source = useMemo(() => ({ path, keys, select, throttle, userId }), [path, keys, select, throttle, userId]);
  const [snapshot, setSnapshot] = useState(null);
  useEffect(() => {
    if (!source.path) return;
    let active = true;
    let value = {};
    const received = new Set();
    const errors = new Map();
    const publish = () => setSnapshot({ source, value, loading: received.size < keys.length && errors.size === 0,
      error: errors.values().next().value || null });
    const unsubs = keys.map(key => {
      const leaf = realtimeSource(`${source.path}/${key}`, { select: source.select?.[key], throttleMs: source.throttle?.[key] || 0, userId: source.userId });
      const receive = () => {
        if (!active) return;
        const snapshot = realtimeSnapshot(leaf);
        if (snapshot.loading) return;
        if (snapshot.error) { errors.set(key, snapshot.error); publish(); return; }
        const next = snapshot.value;
        if (received.has(key) && Object.is(value[key], next) && !errors.has(key)) return;
        received.add(key); errors.delete(key);
        value = { ...value, [key]: next }; publish();
      };
      const unsubscribe = subscribeRealtime(leaf, receive);
      receive();
      return unsubscribe;
    });
    return () => { active = false; unsubs.forEach((unsub) => unsub()); };
  }, [source, keys]);
  const current = snapshot?.source === source ? snapshot : null;
  return { value: current?.error ? null : current?.value ?? null, loading: Boolean(path && (!current || current.loading)), error: current?.error ?? null };
}
