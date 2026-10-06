import { motion, useReducedMotion } from 'framer-motion';
import { useState, useEffect, useMemo, memo } from 'react';
import { hapticSuccess } from '@/lib/haptics';

// 8 particles at evenly-spaced angles
const PARTICLE_COUNT = 8;
const PARTICLE_ANGLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => (i * 360) / PARTICLE_COUNT);
const PARTICLE_COLORS = [
  'bg-slate-700',
  'bg-slate-400',
  'bg-slate-600',
  'bg-slate-300',
  'bg-slate-500',
  'bg-slate-800',
  'bg-slate-400',
  'bg-slate-200',
];

function ParticleBurst() {
  // mount 시 한 번만 random 거리 계산 — render body에서 Math.random 호출 회피
  const particles = useMemo(
    () => PARTICLE_ANGLES.map((angle, i) => {
      const rad = (angle * Math.PI) / 180;
       
      const distance = 36 + Math.random() * 12;
      return {
        tx: Math.cos(rad) * distance,
        ty: Math.sin(rad) * distance,
        size: 4 + (i % 3) * 2,
      };
    }),
    []
  );
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {PARTICLE_ANGLES.map((angle, i) => {
        const { tx, ty, size } = particles[i];
        return (
          <motion.span
            key={i}
            className={`absolute rounded-full ${PARTICLE_COLORS[i % PARTICLE_COLORS.length]}`}
            style={{
              width: size,
              height: size,
              top: '50%',
              left: '50%',
              marginTop: -(size / 2),
              marginLeft: -(size / 2),
            }}
            initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
            animate={{
              x: tx,
              y: ty,
              scale: [0, 1.2, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 0.55,
              delay: 0.18 + i * 0.015,
              ease: [0.25, 0.1, 0.25, 1],
            }}
          />
        );
      })}
    </div>
  );
}

function AnimatedCheck({ reduced }) {
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      {/* Ring pulse — expands outward and fades after check */}
      {!reduced && <motion.div
        className="absolute inset-0 rounded-full border-2 border-slate-900 dark:border-slate-100"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: [0.6, 1.6, 1.6], opacity: [0, 0.5, 0] }}
        transition={{ delay: 0.28, duration: 0.55, ease: [0, 0.55, 0.45, 1] }}
      />}

      {/* Confirmation circle settles once */}
      <motion.div
        initial={reduced ? false : { scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className="absolute inset-0 bg-slate-900 dark:bg-slate-100 rounded-full"
      />

      {/* Particle burst centered on circle */}
      {!reduced && <ParticleBurst />}

      {/* White checkmark draws in */}
      <motion.svg
        viewBox="0 0 24 24"
        fill="none"
        className="relative z-10 w-8 h-8"
      >
        <motion.path
          d="M6 13l4 4L18 7"
          className="stroke-white dark:stroke-slate-900"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduced ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: reduced ? 0 : 0.1, duration: reduced ? 0 : 0.24, ease: [0.25, 0.1, 0.25, 1] }}
        />
      </motion.svg>
    </div>
  );
}

export default memo(function VoteConfirm({
  submittedLabel = '투표 완료!',
  waitingLabel = '결과를 기다리는 중...',
  submittedDescription = '응답이 기록되었습니다',
  waitingDescription = '강사가 다음 단계를 진행하면 표시됩니다',
  selectedAnswer = null,
  selectedAnswerLabel = '내 응답',
}) {
  const [waiting, setWaiting] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    hapticSuccess();
    const timer = setTimeout(() => setWaiting(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      role="status"
      aria-live="polite"
      className="w-full rounded-xl bg-white dark:bg-slate-800 px-5 py-8 shadow-sm ring-1 ring-slate-200/70 dark:ring-slate-700/60"
    >
      <div className="flex flex-col items-center gap-5">
        {/* One-time confirmation feedback */}
        <motion.div
          animate={{ scale: 1 }}
        >
          <AnimatedCheck reduced={reduced} />
        </motion.div>

        {/* Label + description */}
        <div className="space-y-1 text-center">
          <motion.p
            key={waiting ? 'w' : 'd'}
            initial={reduced ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              opacity: { duration: 0.2 },
              y: { duration: 0.2 },
            }}
            className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100"
          >
            {waiting ? waitingLabel : submittedLabel}
          </motion.p>
          <motion.p
            key={waiting ? 'wd' : 'dd'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.25 }}
            className="text-sm text-slate-600 dark:text-slate-400"
          >
            {waiting ? waitingDescription : submittedDescription}
          </motion.p>
          {/* 대기 dots — 문장 꼬리에 붙어 어색하던 것을 아래 중앙으로 분리 */}
          {waiting && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="flex justify-center gap-1 pt-2"
            >
              {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500"
                    animate={{ opacity: 0.7 }}
                    transition={{ duration: 0.16 }}
                  />
                ))}
            </motion.span>
          )}
        </div>

        {/* Selected answer pill */}
        {selectedAnswer && (
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, type: 'spring', stiffness: 300, damping: 25 }}
            className="rounded-xl ring-1 ring-slate-200 dark:ring-slate-600 bg-slate-50 dark:bg-slate-700/80 px-4 py-3 text-center w-full"
          >
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">{selectedAnswerLabel}</p>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 line-clamp-3">{selectedAnswer}</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
})
