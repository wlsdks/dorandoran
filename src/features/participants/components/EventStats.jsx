import { motion } from 'framer-motion';
import { IdCard } from 'lucide-react';
import { fadeUp } from '@/lib/motion';
import AnimatedNumber from '@/components/ui/AnimatedNumber';

/**
 * EventStats — 기업 행사모드(사번 필수) 전용 통계.
 * 입장 인원 + 사번 등록 인원/등록률. requireEmployeeId 세션에서만 렌더.
 *
 * @param {Array} participants 온라인 참여자 배열([{ employeeId, ... }])
 * @param {number} count 입장(접속) 인원 — 없으면 participants.length
 * @param {'sidebar'|'presenter'} variant 표시 크기
 */
export default function EventStats({ participants = [], count, variant = 'sidebar' }) {
  const total = count ?? participants.length;
  const registered = participants.filter((p) => p?.employeeId).length;
  const pct = total > 0 ? Math.round((registered / total) * 100) : 0;

  if (variant === 'presenter') {
    return (
      <motion.div
        initial={fadeUp.initial}
        animate={fadeUp.animate}
        transition={fadeUp.transition}
        className="flex items-stretch gap-4"
      >
        <Stat big label="입장" value={total} unit="명" />
        <div className="w-px bg-slate-200 dark:bg-slate-700" />
        <Stat big label="사번 등록" value={registered} unit="명" sub={`${pct}%`} accent />
      </motion.div>
    );
  }

  // sidebar (compact)
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-700/40 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
        <IdCard size={13} /> 사번 등록
      </div>
      <div className="text-right">
        <span className="text-slate-900 dark:text-slate-100 font-bold text-sm tabular-nums">{registered}</span>
        <span className="text-slate-400 text-xs"> / {total}명</span>
        <span className="ml-1.5 text-indigo-500 dark:text-indigo-400 font-semibold text-xs tabular-nums">{pct}%</span>
      </div>
    </div>
  );
}

function Stat({ label, value, unit, sub, big, accent }) {
  return (
    <div className="text-center px-2">
      <div className="flex items-baseline justify-center gap-1">
        <span className={`font-black tabular-nums tracking-tight ${big ? 'text-5xl md:text-6xl' : 'text-2xl'} ${accent ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-900 dark:text-slate-100'}`}>{big ? <AnimatedNumber value={value} /> : value}</span>
        {unit && <span className="text-slate-400 text-sm font-medium">{unit}</span>}
      </div>
      <div className="mt-1 flex items-center justify-center gap-1.5">
        <span className="text-slate-400 dark:text-slate-500 text-xs font-medium uppercase tracking-wider">{label}</span>
        {sub && <span className="text-indigo-500 dark:text-indigo-400 text-xs font-bold tabular-nums">{sub}</span>}
      </div>
    </div>
  );
}
