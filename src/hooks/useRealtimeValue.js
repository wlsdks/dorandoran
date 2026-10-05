import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { auth } from '@/lib/auth-session';
import { realtimeSource, realtimeSnapshot, subscribeRealtime } from '@/lib/realtime-store';

/** 새 경로/권한/회차는 이전 값을 노출하지 않는다. 동일 쿼리의 소비자는 하나의 구독을 공유한다. */
export function useRealtimeValue(path, { limit, scope, select, throttleMs = 0 } = {}) {
  const userId = auth.currentUser?.uid;
  const source = useMemo(() => realtimeSource(path, { limit, scope, select, throttleMs, userId }), [path, limit, scope, select, throttleMs, userId]);
  const subscribe = useCallback(listener => subscribeRealtime(source, listener), [source]);
  const snapshot = useCallback(() => realtimeSnapshot(source), [source]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
