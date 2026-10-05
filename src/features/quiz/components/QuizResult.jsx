import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Check, X, Flame } from 'lucide-react';
const ConfettiBurst = lazy(() => import('@/components/ui/ConfettiBurst'));
import { hapticTap } from '@/lib/haptics';

// spring presets
const SPRING_BOUNCY = {
  type: 'spring',
  stiffness: 400,
  damping: 22
};
const SPRING_DEFAULT = {
  type: 'spring',
  stiffness: 300,
  damping: 25
};
function CountUp({
  value,
  prefix = '+',
  suffix = '점'
}) {
  const motionVal = useMotionValue(0);
  const rounded = useTransform(motionVal, v => Math.round(v));
  const ref = useRef(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const unsubscribe = rounded.on('change', v => {
      if (ref.current) ref.current.textContent = `${prefix}${v}${suffix}`;
    });
    const controls = animate(motionVal, value, {
      duration: 0.9,
      ease: [0.25, 0.1, 0.25, 1],
      onComplete: () => {
        setDone(true);
        hapticTap();
      }
    });
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [value, motionVal, rounded, prefix, suffix]);
  return <motion.span ref={ref} animate={done ? {
    scale: [1, 1.22, 0.96, 1.06, 1]
  } : {}} transition={SPRING_BOUNCY}>
      {prefix}{value}{suffix}
    </motion.span>;
}

/** Correct state: icon circle with expanding ring pulse */
function CorrectIcon() {
  return <div className="relative flex items-center justify-center">
      {/* Expanding ring */}
      <motion.div initial={{
      scale: 0.6,
      opacity: 0.8
    }} animate={{
      scale: 2.2,
      opacity: 0
    }} transition={{
      duration: 0.7,
      ease: 'easeOut',
      delay: 0.1
    }} className="absolute w-14 h-14 rounded-full border-2 border-slate-300 dark:border-slate-600" />
      {/* Icon container */}
      <motion.div initial={{
      scale: 0
    }} animate={{
      scale: [0, 1.25, 0.9, 1.05, 1]
    }} transition={{
      ...SPRING_BOUNCY,
      delay: 0.08
    }} className="w-14 h-14 rounded-full bg-slate-900 dark:bg-slate-100 flex items-center justify-center">
        <Check size={28} className="text-white dark:text-slate-900" strokeWidth={2.5} />
      </motion.div>
    </div>;
}

/** Incorrect state: icon with shake */
function IncorrectIcon() {
  return <motion.div initial={{
    scale: 0
  }} animate={{
    scale: 1
  }} transition={{
    ...SPRING_DEFAULT,
    delay: 0.08
  }} className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
      <X size={28} className="text-slate-400 dark:text-slate-500" strokeWidth={2.5} />
    </motion.div>;
}
export default function QuizResult({
  isCorrect,
  points,
  correctAnswer,
  bet = 1,
  streak = 0
}) {
  const shakeVariants = {
    initial: {
      opacity: 0,
      y: 16,
      x: 0
    },
    animate: isCorrect ? {
      opacity: 1,
      y: 0,
      x: 0
    } : {
      opacity: 1,
      y: 0,
      x: [0, -7, 6, -5, 4, -2, 0]
    },
    transition: isCorrect ? SPRING_DEFAULT : {
      ...SPRING_DEFAULT,
      x: {
        delay: 0.2,
        duration: 0.45,
        ease: 'easeInOut'
      }
    }
  };
  return <motion.div initial={shakeVariants.initial} animate={shakeVariants.animate} transition={shakeVariants.transition} className={`w-full rounded-2xl px-5 py-8 overflow-hidden relative ${isCorrect ? 'bg-white dark:bg-slate-800 shadow-sm' : 'bg-white dark:bg-slate-800 shadow-sm'}`}>
      {isCorrect && <Suspense fallback={null}><ConfettiBurst /></Suspense>}

      <div className="flex flex-col items-center gap-5 relative z-[1]">
        {/* Icon */}
        {isCorrect ? <CorrectIcon /> : <IncorrectIcon />}

        {/* Status label */}
        <motion.div initial={{
        opacity: 0,
        y: 8
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        ...SPRING_DEFAULT,
        delay: 0.18
      }} className="space-y-1 text-center">
          <p className={`text-2xl font-bold tracking-tight ${isCorrect ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
            {isCorrect ? '정답!' : '오답'}
          </p>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            {isCorrect ? streak >= 3 ? '연승 행진 중! 계속 이어가세요' : '잘 하셨어요!' : '다음 문제에서 만회할 수 있습니다'}
          </p>
        </motion.div>

        {/* Streak fire badge */}
        {isCorrect && streak >= 3 && <motion.div initial={{
        opacity: 0,
        scale: 0.5,
        y: 6
      }} animate={{
        opacity: 1,
        scale: 1,
        y: 0
      }} transition={{
        ...SPRING_BOUNCY,
        delay: 0.22
      }} className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full shadow-sm ${streak >= 5 ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`}>
            <motion.div animate={{
          rotate: [-5, 5, -5],
          scale: [1, 1.2, 1]
        }} transition={{
          repeat: Infinity,
          duration: streak >= 5 ? 0.5 : 0.8,
          ease: 'easeInOut'
        }}>
              <Flame size={15} className={streak >= 5 ? 'text-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-400'} />
            </motion.div>
            <span className="font-bold text-sm tabular-nums">{streak}연속 정답!</span>
          </motion.div>}

        {/* Correct answer reveal */}
        {correctAnswer && <motion.div initial={{
        opacity: 0,
        y: 10,
        scale: 0.96
      }} animate={{
        opacity: 1,
        y: 0,
        scale: 1
      }} transition={{
        ...SPRING_DEFAULT,
        delay: 0.28
      }} className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 py-3.5 text-center">
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">정답</p>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{correctAnswer}</p>
          </motion.div>}

        {/* Bet multiplier badge */}
        {bet > 1 && <motion.div initial={{
        opacity: 0,
        scale: 0.85
      }} animate={{
        opacity: 1,
        scale: 1
      }} transition={{
        ...SPRING_DEFAULT,
        delay: 0.24
      }} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold">
            {bet}x 베팅
          </motion.div>}

        {/* 점수 */}
        {(points > 0 || points < 0) && <motion.div initial={{
        opacity: 0,
        y: 14,
        scale: 0.9
      }} animate={{
        opacity: 1,
        y: 0,
        scale: 1
      }} transition={{
        ...SPRING_BOUNCY,
        delay: isCorrect ? 0.32 : 0.38
      }} className="flex items-center justify-center gap-6 pt-1">
            {points !== 0 && <div className="text-center">
                <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-0.5">점수</p>
                <p className={`text-3xl font-bold tracking-tight tabular-nums ${points < 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>
                  <CountUp value={Math.abs(points)} prefix={points < 0 ? '-' : '+'} />
                </p>
              </div>}


          </motion.div>}

      </div>
    </motion.div>;
}
