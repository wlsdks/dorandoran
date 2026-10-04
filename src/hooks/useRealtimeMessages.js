import { useCallback, useMemo } from 'react';
import { push, ref, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { EMPTY_RECORD } from '@/lib/realtime';
import { logger } from '@/lib/logger';
import { useCooldown } from './useCooldown';
import { useRealtimeValue } from './useRealtimeValue';

/** 공개 채팅과 스태프 채팅의 구독·정렬·중복 전송 방지를 함께 관리한다. */
export function useRealtimeMessages(sessionId, channel, { enabled = true, limit = 100 } = {}) {
  const path = sessionId && enabled ? `sessions/${sessionId}/${channel}` : null;
  const { value, loading, error } = useRealtimeValue(path, { limit });
  const { canSend, begin, finish, fail } = useCooldown(path, 2000);
  const messages = useMemo(() => Object.entries(value || EMPTY_RECORD).map(([id, message]) => ({ id, ...message }))
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)), [value]);
  const sendMessage = useCallback(async (text, sender, senderType) => {
    const trimmed = text?.trim();
    if (!path || !trimmed) return false;
    const attempt = begin();
    if (attempt === null) return false;
    try {
      await push(ref(db, path), { text: trimmed, sender: sender || (channel === 'staffChat' ? '스태프' : '익명'),
        senderType: senderType || (channel === 'staffChat' ? 'staff' : 'student'), timestamp: serverTimestamp() });
      return finish(attempt);
    } catch (err) { fail(attempt); logger.error('채팅 전송 실패:', err); return false; }
  }, [path, channel, begin, finish, fail]);
  return { messages, loading, error, canSend: Boolean(path) && canSend, sendMessage };
}
