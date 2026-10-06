import { ref, onValue, update, runTransaction, serverTimestamp } from 'firebase/database';
import { useEffect, useCallback } from 'react';
import { useRealtimeValue } from '@/hooks/useRealtimeValue';
import { db } from '@/lib/firebase';

// 서버 시간 오프셋 캐시 — 모든 useTimer 인스턴스가 공유.
// 기존에는 Date.now()(강사 기기 시계)로 endTime을 저장해서 강사-학생 기기 시간 차이만큼
// 타이머가 어긋났음. Firebase의 .info/serverTimeOffset은 "서버시간 - 클라이언트시간"(ms)
// 이므로 Date.now() + offset = 서버 시간 기준 now.
let cachedOffset = 0;
let offsetConsumers = 0;
let offsetUnsubscribe = null;
function subscribeServerOffset() {
  offsetConsumers++;
  if (!offsetUnsubscribe) offsetUnsubscribe = onValue(ref(db, '.info/serverTimeOffset'), (snap) => {
    cachedOffset = snap.val() || 0;
  });
  return () => {
    if (--offsetConsumers === 0) {
      offsetUnsubscribe?.();
      offsetUnsubscribe = null;
      cachedOffset = 0;
    }
  };
}

// 쉬는 시간·토론·복권·스피드 퀴즈처럼 useTimer 없이 getServerNow()만 쓰는 화면도 서버 시각을 따르도록,
// 처음 호출될 때 오프셋 구독을 영구로 붙잡는다(언마운트로 0으로 돌아가 기기 시계를 쓰는 일이 없게).
let permanentOffset = false;
function ensureServerOffset() {
  if (permanentOffset) return;
  permanentOffset = true;
  subscribeServerOffset();
}

// Consumer가 보정된 now를 직접 쓸 수 있도록 export — remaining 계산 시 Date.now() 대신 사용.
export function getServerNow() {
  ensureServerOffset();
  return Date.now() + cachedOffset;
}

export function useTimer(sessionId) {
  const { value: timerData } = useRealtimeValue(sessionId ? `sessions/${sessionId}/timer` : null);
  useEffect(() => {
    if (sessionId) return subscribeServerOffset();
  }, [sessionId]);

  const startTimer = useCallback(async (durationSeconds) => {
    if (!sessionId) return;
    // 서버 시간 기준 endTime — 강사 기기 시계 편차 보정. 모든 클라이언트가 같은 기준으로
    // remaining = endTime - (Date.now() + cachedOffset) 으로 계산 가능.
    const endTime = Date.now() + cachedOffset + durationSeconds * 1000;
    await update(ref(db, `sessions/${sessionId}/timer`), {
      endTime,
      duration: durationSeconds,
      running: true,
      startedAt: serverTimestamp(),
    });
  }, [sessionId]);

  const stopTimer = useCallback(async () => {
    if (!sessionId) return;
    await update(ref(db, `sessions/${sessionId}/timer`), {
      endTime: null,
      running: false,
      duration: 0,
    });
  }, [sessionId]);

  const expireTimer = useCallback(async () => {
    const expectedEndTime = timerData?.endTime;
    if (!sessionId || !expectedEndTime) return;
    // Natural expiry keeps the Rules deadline. A stale ring must not finish a restarted timer.
    await runTransaction(ref(db, `sessions/${sessionId}/timer`), (current) => {
      if (!current?.running || current.endTime !== expectedEndTime || getServerNow() < current.endTime) return;
      return { ...current, running: false };
    }, { applyLocally: false });
  }, [sessionId, timerData?.endTime]);

  return {
    isRunning: timerData?.running === true,
    endTime: timerData?.endTime || null,
    duration: timerData?.duration || 0,
    startTimer,
    stopTimer,
    expireTimer,
  };
}
