import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { colors } from '@/lib/design-tokens';
import { getServerNow } from '@/features/timer/api/useTimer';

const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function getColor(secondsLeft, totalSeconds) {
  const ratio = secondsLeft / totalSeconds;
  if (ratio > 0.5) return { ring: colors.success, text: 'text-emerald-600' }; // green
  if (ratio > 0.2) return { ring: colors.warning, text: 'text-amber-600' };   // amber
  return { ring: colors.error, text: 'text-red-500' };                        // red
}

export default function TimerRing({ endTime, duration, onExpire, size = 'md' }) {
  const [secondsLeft, setSecondsLeft] = useState(duration);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!endTime) return;
    firedRef.current = false;
    let interval;

    function tick() {
      // 만료 후엔 interval 정지 — 완료 콜백이 200ms마다 반복 호출되던 버그 방지
      if (firedRef.current) { if (interval) clearInterval(interval); return; }
      // 서버 시간 기준 remaining — 학생 기기 시계 편차 보정 (endTime은 서버 시간 기준 저장됨)
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
  const offset = CIRCUMFERENCE * (1 - progress);
  const color = getColor(secondsLeft, duration);
  const isPulsing = secondsLeft <= 5 && secondsLeft > 0;

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  return (
    <motion.div
      animate={isPulsing ? { scale: [1, 1.05, 1] } : {}}
      transition={isPulsing ? { repeat: Infinity, duration: 0.8 } : {}}
      className={`relative ${sizeClasses[size]} flex items-center justify-center`}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        {/* Track */}
        <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="currentColor" strokeWidth="6" className="text-slate-200 dark:text-slate-600" />
        {/* Progress ring */}
        <motion.circle
          cx="50" cy="50" r={RADIUS}
          fill="none"
          stroke={color.ring}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.3, ease: 'linear' }}
        />
      </svg>
      <div className={`absolute inset-0 flex items-center justify-center font-bold ${textSizes[size]} ${color.text}`}>
        {secondsLeft}
      </div>
    </motion.div>
  );
}
