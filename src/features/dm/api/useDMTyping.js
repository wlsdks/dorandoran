import { useRealtimeValue } from '@/hooks/useRealtimeValue';
import { EMPTY_RECORD } from '@/lib/realtime';
import { getServerNow } from '@/features/timer/api/useTimer';
import { ref, update, remove } from 'firebase/database';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';

/**
 * useDMTyping — 스태프가 입력창에 타이핑 중임을 실시간 공유.
 * Firebase: sessions/{sid}/dm/{dmId}/typing/{userId} = { name, at }
 *
 * 반환:
 * - notifyTyping(): 현재 사용자가 타이핑 중임을 서버에 갱신 (throttle 1s)
 * - activeTypers: 최근 3초 이내 갱신된 다른 사용자 목록 [{ id, name }]
 */
export function useDMTyping(sessionId, dmId, { userId, userName } = {}) {
  const path = sessionId && dmId ? `sessions/${sessionId}/dm/${dmId}/typing` : null;
  const { value } = useRealtimeValue(path);
  const typingMap = value || EMPTY_RECORD;
  const [now, setNow] = useState(() => Date.now());
  const lastWriteRef = useRef(0);

  // activeTypers 계산을 pure하게 — Date.now()를 state로 끌어올려 비결정성 제거
  const activeTypers = useMemo(() => {
    const cutoff = Math.max(now, getServerNow()) - 3000;
    return Object.entries(typingMap)
      .filter(([id, v]) => id !== userId && typeof v?.at === 'number' && v.at > cutoff)
      .map(([id, v]) => ({ id, name: v.name || '스태프' }));
  }, [typingMap, userId, now]);

  const hasForeignSignals = activeTypers.length > 0;
  useEffect(() => {
    lastWriteRef.current = 0;
  }, [path]);
  useEffect(() => {
    if (!path || !hasForeignSignals) return;
    const interval = setInterval(() => setNow(getServerNow()), 1000);
    return () => clearInterval(interval);
  }, [path, hasForeignSignals]);

  const notifyTyping = useCallback(async () => {
    if (!sessionId || !dmId || !userId) return;
    const now = getServerNow();
    if (now - lastWriteRef.current < 1500) return; // throttle 1.5s
    lastWriteRef.current = now;
    try {
      await update(ref(db, `sessions/${sessionId}/dm/${dmId}/typing/${userId}`), {
        name: userName || '스태프',
        at: now,
      });
    } catch (err) {
      // typing signal은 best-effort — 실패해도 사용자 경험엔 영향 없음
      logger.warn('Typing signal failed:', err?.message || err);
    }
  }, [sessionId, dmId, userId, userName]);

  const clearTyping = useCallback(async () => {
    if (!sessionId || !dmId || !userId) return;
    try {
      await remove(ref(db, `sessions/${sessionId}/dm/${dmId}/typing/${userId}`));
    } catch { /* ignore */ }
  }, [sessionId, dmId, userId]);

  return { activeTypers, notifyTyping, clearTyping };
}
