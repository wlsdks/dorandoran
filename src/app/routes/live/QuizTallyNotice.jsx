import { memo, useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useRealtimeValue } from '@/hooks/useRealtimeValue';
import { isQuizTallyStale } from '@/lib/quiz-distribution';

/**
 * 퀴즈 집계는 강사 화면이 보낸다. 강사 노트북이 잠들거나 탭이 닫히면 전자칠판 숫자가 멈추므로,
 * 신호가 끊기면 조용히 0을 보여주는 대신 짧게 알린다.
 */
export default memo(function QuizTallyNotice({ sessionId, questionId, activatedAt }) {
  const { value: aggregate } = useRealtimeValue(sessionId && questionId ? `sessions/${sessionId}/publicQuizAggregates/${questionId}` : null);
  const { value: offset } = useRealtimeValue('.info/serverTimeOffset');
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);
  const stale = isQuizTallyStale(aggregate, { now: tick + (Number(offset) || 0), activatedAt });
  if (!stale) return null;
  return (
    <p role="status" className="relative z-50 mx-auto flex w-fit items-center gap-2 rounded-full bg-slate-800 px-4 py-2 text-base text-slate-300">
      <WifiOff size={18} aria-hidden="true" />강사 화면 연결을 확인해주세요 · 응답 집계가 잠시 멈췄어요
    </p>
  );
});
