import { ensureDMThread } from '@/lib/dm';
import { useRealtimeValue } from '@/hooks/useRealtimeValue';
import { EMPTY_RECORD } from '@/lib/realtime';
import { ref, push, update, serverTimestamp, runTransaction } from 'firebase/database';
import { useCallback, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';

/**
 * Staff-side DM hook. Subscribes to ALL DM threads.
 * @param {string} sessionId
 * @returns {{ waitingDMs, activeDMs, respondToDM, resolveDM, sendMessage }}
 */
export function useStaffDMs(sessionId) {
  const { value, loading } = useRealtimeValue(sessionId ? `sessions/${sessionId}/dm` : null);
  const allThreads = value || EMPTY_RECORD;

  const { waitingDMs, activeDMs } = useMemo(() => {
    const waiting = [];
    const active = [];
    for (const [id, thread] of Object.entries(allThreads)) {
      const msgs = thread.messages
        ? Object.entries(thread.messages)
            .map(([mid, m]) => ({ id: mid, ...m }))
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
        : [];
      const item = { id, ...thread, messageList: msgs };
      if (thread.status === 'waiting') waiting.push(item);
      else if (thread.status === 'active') active.push(item);
    }
    waiting.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    active.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return { waitingDMs: waiting, activeDMs: active };
  }, [allThreads]);

  /**
   * respondToDM — 담당 스태프 선점.
   * 이미 다른 스태프가 담당 중이면 no-op으로 취급하고 { alreadyClaimedBy } 반환.
   * 트랜잭션으로 race를 막아 "먼저 누른 사람이 담당"이 확정됨.
   */
  const respondToDM = useCallback(async (dmId, staffId, staffName) => {
    if (!sessionId || !dmId) return { claimed: false };
    try {
      const threadRef = ref(db, `sessions/${sessionId}/dm/${dmId}`);
      const tx = await runTransaction(threadRef, (current) => {
        if (!current || (current.staffId && current.staffId !== staffId)) return undefined;
        return { ...current, staffId, staffName: current.staffName || staffName, status: 'active' };
      }, { applyLocally: false });
      return { claimed: tx.committed, alreadyClaimedBy: tx.committed ? null : tx.snapshot.val()?.staffName || '다른 스태프', dmId, snapshot: tx.snapshot.val() };
    } catch (err) {
      logger.error('Respond to DM failed:', err);
      return { claimed: false, error: err };
    }
  }, [sessionId]);

  const resolveDM = useCallback(async (dmId) => {
    if (!sessionId || !dmId) return;
    try {
      await update(ref(db, `sessions/${sessionId}/dm/${dmId}`), {
        status: 'resolved',
      });
    } catch (err) {
      logger.error('Resolve DM failed:', err);
    }
  }, [sessionId]);

  const sendMessage = useCallback(async (dmId, text, senderName, senderType) => {
    if (!sessionId || !dmId || !text?.trim()) return false;
    try {
      await push(ref(db, `sessions/${sessionId}/dm/${dmId}/messages`), {
        text: text.trim(),
        sender: senderName || '스태프',
        senderType: senderType || 'staff',
        timestamp: serverTimestamp(),
      });
      return true;
    } catch (err) {
      logger.error('DM send failed:', err);
      return false;
    }
  }, [sessionId]);

  /**
   * ensureDMForStudent — 학생별 단일 active/waiting DM 보장.
   * sessions/{sid}/dmByStudent/{studentId} 포인터를 runTransaction으로 선점 →
   * 여러 스태프가 동시에 같은 학생 DM을 열어도 단 하나만 생성.
   * resolved 이력 DM은 무시하고 새로 시작한다.
   *
   * 반환: { dmId, existed } — existed=true면 기존 DM 재사용
   */
  const ensureDMForStudent = useCallback(async ({ studentId, studentName, staffId, staffName, firstMessage }) => {
    if (!sessionId || !studentId) throw new Error('세션 또는 학생 ID 누락');
    const result = await ensureDMThread(sessionId, { studentId, studentName, staffId, staffName });
    if (firstMessage && !result.existed) await push(ref(db, `sessions/${sessionId}/dm/${result.dmId}/messages`), {
      ...firstMessage, timestamp: serverTimestamp(),
    });
    return result;
  }, [sessionId]);

  return { waitingDMs, activeDMs, respondToDM, resolveDM, sendMessage, ensureDMForStudent, loading };
}
