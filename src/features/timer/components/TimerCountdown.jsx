import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { getServerNow } from '@/features/timer/api/useTimer';
import { spring, roll, exitTween } from '@/lib/motion';

function getColor(secondsLeft, totalSeconds) {
  const ratio = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;
  // Functional urgency colors — Tailwind classes for dark mode support
  if (ratio > 0.5) return { bar: 'bg-slate-900 dark:bg-slate-200', bg: 'bg-white dark:bg-slate-800', text: 'text-slate-900 dark:text-slate-100' };
  if (ratio > 0.2) return { bar: 'bg-amber-500', bg: 'bg-white dark:bg-slate-800', text: 'text-amber-600 dark:text-amber-400' };
  return { bar: 'bg-red-500', bg: 'bg-white dark:bg-slate-800', text: 'text-red-500 dark:text-red-400' };
}

function formatTime(seconds) {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  return `${seconds}초`;
}

/**
 * Horizontal countdown bar for student vote page.
 * Shows remaining time with progress bar + color transitions.
 * Pulses in final 5 seconds.
 */
export default function TimerCountdown({ endTime, duration, onExpire, presenter = false }) {
  const [secondsLeft, setSecondsLeft] = useState(duration);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!endTime) return;
    firedRef.current = false;
    let interval;

    function tick() {
      // 만료 후엔 interval 정지 — onExpire가 200ms마다 무한 호출되던 버그 방지
      if (firedRef.current) { if (interval) clearInterval(interval); return; }
      // 서버 시간 기준 remaining — 학생 기기 시계 편차 보정 (endTime은 서버 기준으로 저장됨)
      const remaining = Math.max(0, Math.ceil((endTime - getServerNow()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        firedRef.current = true;
        onExpire?.();
        if (interval) clearInterval(interval);
      }
    }

    tick();
    interval = setInterval(tick, 200);
    return () => { if (interval) clearInterval(interval); };
  }, [endTime, onExpire]);

  const progress = duration > 0 ? secondsLeft / duration : 0;
  const color = getColor(secondsLeft, duration);
  const isPulsing = secondsLeft <= 5 && secondsLeft > 0;
  const isUrgent = secondsLeft <= 3 && secondsLeft > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: exitTween }}
      transition={spring.default}
      className={`rounded-xl shadow-sm ${presenter ? 'px-6 py-4 border border-slate-700' : 'px-4 py-3'} ${color.bg} transition-colors duration-300`}
    >
      <motion.div
        // 마지막 5초는 심장 박동처럼 — 흔들지 않고(멀미) 1초에 한 번 커졌다 돌아온다. 3초 이하에선 조금 더 크게.
        animate={isUrgent ? { scale: [1, 1.05, 1] } : isPulsing ? { scale: [1, 1.03, 1] } : { scale: 1 }}
        transition={isPulsing ? { repeat: Infinity, duration: isUrgent ? 0.5 : 0.6, ease: 'easeInOut' } : {}}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Clock size={presenter ? 20 : 14} className={`${color.text} transition-colors duration-300`} />
            <span className={`${presenter ? 'text-[clamp(16px,1.1vw,24px)]' : 'text-xs'} font-medium ${color.text} transition-colors duration-300`}>
              남은 시간
            </span>
          </div>
          <motion.span
            key={secondsLeft}
            initial={{ opacity: 0.4, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={roll}
            className={`${presenter ? 'text-[clamp(22px,1.7vw,38px)] leading-none' : 'text-sm'} font-bold tabular-nums ${color.text} transition-colors duration-300`}
          >
            {formatTime(secondsLeft)}
          </motion.span>
        </div>
        <div className={`${presenter ? 'h-2.5' : 'h-1.5'} bg-slate-200/60 dark:bg-slate-600/60 rounded-full overflow-hidden`}>
          {/* width 대신 scaleX(GPU 합성) — 활성질문 내내 300대 모바일에서 layout/paint 반복 제거 */}
          <motion.div
            className={`h-full w-full origin-left rounded-full ${color.bar}`}
            animate={{ scaleX: progress }}
            transition={{ duration: 0.2, ease: 'linear' }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
