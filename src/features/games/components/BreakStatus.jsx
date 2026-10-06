import { Coffee } from 'lucide-react';
import { useBreakState } from '@/features/games/api/useBreakState';
import { formatClock, formatRemaining } from '@/lib/break-time';

/** 학생 화면용 쉬는 시간/대기 시간 — 이름과 시간만 한 덩어리로 짧게. */
export default function BreakStatus({ sessionId }) {
  const { label, style, phase, remaining, endsAt } = useBreakState(sessionId);
  const time = phase === 'idle' ? null
    : phase === 'finished' ? '곧 시작해요'
    : style === 'startAt' ? `${formatClock(endsAt)} 시작` : formatRemaining(remaining);
  return (
    <div role="status" className="inline-flex flex-col items-center gap-1 rounded-2xl bg-white px-6 py-4 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-800 dark:ring-slate-700/60">
      <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
        <Coffee size={16} className="text-slate-400" aria-hidden="true" />{label}
      </span>
      {time && <span className="text-3xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-slate-100">{time}</span>}
      {style === 'startAt' && phase === 'running' && <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">{formatRemaining(remaining)} 남음</span>}
    </div>
  );
}
