import { motion } from 'framer-motion';
import { WifiOff } from 'lucide-react';

/**
 * ConnectionStatusIcon — 연결 상태를 원형 선(ring)으로 표시한다.
 * retrying: 호가 돌며 재연결 시도 중임을 보여준다. offline: 멈춘 선 + 끊김 아이콘.
 * restored: 초록 원이 그려진 뒤 체크가 그려진다.
 */
export default function ConnectionStatusIcon({ state, size = 64 }) {
  const restored = state === 'restored';
  // 작은 크기(헤더 칩)에서는 선을 굵게 하고 안쪽 아이콘을 뺀다.
  const compact = size < 32;
  const stroke = compact ? 7 : 4;
  return (
    <span className="relative block shrink-0" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full">
        <circle cx="32" cy="32" r="28" fill="none" strokeWidth={stroke} className="stroke-slate-200 dark:stroke-slate-700" />
        {state === 'retrying' && (
          <motion.circle
            cx="32" cy="32" r="28" fill="none" strokeWidth={stroke} strokeLinecap="round"
            className="stroke-amber-500" strokeDasharray="44 132"
            style={{ originX: '50%', originY: '50%' }}
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
          />
        )}
        {restored && (
          <>
            <motion.circle
              cx="32" cy="32" r="28" fill="none" strokeWidth={stroke} strokeLinecap="round"
              className="stroke-emerald-500" transform="rotate(-90 32 32)"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            />
            <motion.path
              d="M21 33 l7.5 7.5 L43 25" fill="none" strokeWidth={stroke + 0.5} strokeLinecap="round" strokeLinejoin="round"
              className="stroke-emerald-500"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
              transition={{ duration: 0.25, delay: 0.3, ease: 'easeOut' }}
            />
          </>
        )}
      </svg>
      {!restored && !compact && (
        <span className="absolute inset-0 flex items-center justify-center text-amber-500">
          <WifiOff size={Math.round(size * 0.4)} strokeWidth={2.2} />
        </span>
      )}
    </span>
  );
}
