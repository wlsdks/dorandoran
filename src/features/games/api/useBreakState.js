import { useEffect, useState } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useRealtimeValue } from '@/hooks/useRealtimeValue';
import { getServerNow } from '@/features/timer/api/useTimer';
import { breakEndsAt, breakState, normalizeBreakLabel, normalizeBreakStyle } from '@/lib/break-time';

/**
 * 쉬는 시간/대기 시간 상태 — 세션의 breakEndsAt·breakDuration·breakLabel·breakStyle을 구독하고
 * 서버 시각 기준으로 1초마다 다시 계산한다. 전자칠판·강사·학생 화면이 같은 값을 본다.
 */
export function useBreakState(sessionId) {
  const base = sessionId ? `sessions/${sessionId}` : null;
  const { value: endsAt } = useRealtimeValue(base && `${base}/breakEndsAt`);
  const { value: duration } = useRealtimeValue(base && `${base}/breakDuration`);
  const { value: label } = useRealtimeValue(base && `${base}/breakLabel`);
  const { value: style } = useRealtimeValue(base && `${base}/breakStyle`);
  const [now, setNow] = useState(() => getServerNow());

  // 진행 중에만 초 경계에 맞춰 1초씩 갱신 — 화면마다 초가 어긋나지 않게
  useEffect(() => {
    setNow(getServerNow());
    if (!endsAt) return undefined;
    let id;
    const align = setTimeout(() => {
      setNow(getServerNow());
      id = setInterval(() => setNow(getServerNow()), 1000);
    }, 1000 - (Date.now() % 1000));
    return () => { clearTimeout(align); clearInterval(id); };
  }, [endsAt]);

  const state = breakState({ endsAt, style, label }, now);
  return { ...state, duration: duration || null, now };
}

/** 강사 조작 — 라벨·방식 저장, 시작, 끄기. 실패는 호출부에서 알린다. */
export function breakActions(sessionId) {
  const target = ref(db, `sessions/${sessionId}`);
  return {
    setLabel: label => update(target, { breakLabel: normalizeBreakLabel(label) }),
    start: (minutes, style) => {
      const kind = normalizeBreakStyle(style);
      return update(target, {
        breakEndsAt: breakEndsAt(getServerNow(), minutes, kind),
        breakDuration: minutes * 60,
        breakStyle: kind,
      });
    },
    stop: () => update(target, { breakEndsAt: null, breakDuration: null }),
  };
}
