import { ensureDMThread } from '@/lib/dm';
import { useRealtimeValue } from '@/hooks/useRealtimeValue';
import { EMPTY_RECORD } from '@/lib/realtime';
import { ref, push, serverTimestamp } from 'firebase/database';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';

/**
 * Student-side DM hook. Subscribes to DM threads for this student.
 * @param {string} sessionId
 * @param {string} participantId
 * @returns {{ activeDM, sendMessage, requestHelp }}
 */
export function useStudentDM(sessionId, participantId) {
  const { value: dmId } = useRealtimeValue(sessionId && participantId ? `sessions/${sessionId}/dmByStudent/${participantId}` : null);
  const { value: thread } = useRealtimeValue(sessionId && participantId && dmId ? `sessions/${sessionId}/dm/${dmId}` : null, { scope: participantId });
  const threads = useMemo(() => thread ? { [dmId]: thread } : EMPTY_RECORD, [thread, dmId]);

  // All DM threads (including resolved) with messages
  const allActiveDMs = useMemo(() => {
    return Object.entries(threads)
      .map(([id, thread]) => {
        const msgs = thread.messages
          ? Object.entries(thread.messages)
              .map(([mid, m]) => ({ id: mid, ...m }))
              .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
          : [];
        return { id, ...thread, messageList: msgs };
      })
      .sort((a, b) => {
        // resolved를 맨 아래로
        if (a.status === 'resolved' && b.status !== 'resolved') return 1;
        if (a.status !== 'resolved' && b.status === 'resolved') return -1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
  }, [threads]);

  // First active DM (backward compat)
  const activeDM = allActiveDMs[0] || null;

  const requestHelp = useCallback(async (text, studentName) => {
    if (!sessionId || !participantId || !text?.trim()) return false;
    try {
      const { dmId: targetDmId } = await ensureDMThread(sessionId, { studentId: participantId, studentName });

      await push(ref(db, `sessions/${sessionId}/dm/${targetDmId}/messages`), {
        text: text.trim(),
        sender: studentName || '익명',
        senderType: 'student',
        timestamp: serverTimestamp(),
      });
      return true;
    } catch (err) {
      logger.error('Request help failed:', err);
      return false;
    }
  }, [sessionId, participantId]);

  const sendMessage = useCallback(async (text, senderName) => {
    if (!activeDM?.id || !text?.trim()) return false;
    try {
      await push(ref(db, `sessions/${sessionId}/dm/${activeDM.id}/messages`), {
        text: text.trim(),
        sender: senderName || '익명',
        senderType: 'student',
        timestamp: serverTimestamp(),
      });
      return true;
    } catch (err) {
      logger.error('DM send failed:', err);
      return false;
    }
  }, [sessionId, activeDM]);

  // Track newly resolved DMs — fires once per resolution
  const [newlyResolved, setNewlyResolved] = useState(null);
  const prevStatusRef = useRef({});

  useEffect(() => {
    const prevStatuses = prevStatusRef.current;
    for (const [id, thread] of Object.entries(threads)) {
      if (thread.status === 'resolved' && prevStatuses[id] && prevStatuses[id] !== 'resolved') {
        setNewlyResolved({ id, staffName: thread.staffName || '스태프' });
        break;
      }
    }
    // Update prev statuses
    const next = {};
    for (const [id, thread] of Object.entries(threads)) {
      next[id] = thread.status;
    }
    prevStatusRef.current = next;
  }, [threads]);

  const clearNewlyResolved = useCallback(() => setNewlyResolved(null), []);

  // Track new staff messages — "스태프가 답변을 시작했어요" 토스트용.
  // 초기 로드는 무시 (초기 구독 시 이미 있던 메시지로 토스트 뜨지 않게).
  const [newStaffMessage, setNewStaffMessage] = useState(null);
  const prevStaffCountRef = useRef(null);

  useEffect(() => {
    const next = {};
    for (const [id, thread] of Object.entries(threads)) {
      const staffMsgCount = thread.messages
        ? Object.values(thread.messages).filter((m) => m.senderType === 'staff' || m.senderType === 'instructor').length
        : 0;
      next[id] = { count: staffMsgCount, staffName: thread.staffName || '스태프' };
    }

    if (prevStaffCountRef.current !== null) {
      // 최신 staff 메시지가 추가된 스레드 찾기
      for (const [id, cur] of Object.entries(next)) {
        const prev = prevStaffCountRef.current[id]?.count ?? 0;
        if (cur.count > prev) {
          setNewStaffMessage({ id, staffName: cur.staffName, isFirst: prev === 0 });
          break;
        }
      }
    }
    prevStaffCountRef.current = next;
  }, [threads]);

  const clearNewStaffMessage = useCallback(() => setNewStaffMessage(null), []);

  return {
    activeDM,
    allActiveDMs,
    sendMessage,
    requestHelp,
    newlyResolved,
    clearNewlyResolved,
    newStaffMessage,
    clearNewStaffMessage,
  };
}
