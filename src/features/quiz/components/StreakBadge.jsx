import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { spring } from '@/lib/motion';
import { Flame } from 'lucide-react';

/**
 * StreakBadge — compact flame counter shown during quiz questions.
 * Appears when the student has a streak of 3+ consecutive correct answers.
 * Shows fire icon with shake animation + "N연속!" text.
 *
 * @param {number} streak - current consecutive correct answers
 * @param {boolean} compact - smaller variant for inline use
 */
export default memo(function StreakBadge({ streak = 0, compact = false }) {
  const isOnFire = streak >= 10;
  const isHot = streak >= 5;

  const label = `${streak}연속!`;
  const flameDuration = isOnFire ? 0.35 : isHot ? 0.5 : 0.8;
  const flameScale = isOnFire ? [1, 1.25, 1] : [1, 1.15, 1];

  return (
    <AnimatePresence>
      {streak >= 3 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.7 }}
          transition={spring.bouncy}
          className="flex items-center justify-center"
        >
          <motion.div
            key={streak}
            initial={{ scale: 1.3 }}
            animate={isOnFire ? { scale: [1, 1.04, 1] } : { scale: 1 }}
            transition={isOnFire ? { repeat: Infinity, duration: 1.2 } : spring.stiff}
            className={`inline-flex items-center gap-1.5 rounded-full border shadow-sm ${
              compact ? 'px-2.5 py-1' : 'px-3.5 py-1.5'
            } ${
              isOnFire
                ? 'bg-slate-900 text-white border-slate-700 shadow-lg dark:bg-slate-100 dark:text-slate-900 dark:border-slate-300'
                : isHot
                  ? 'bg-slate-900 text-white border-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-200'
                  : 'bg-white text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
            }`}
          >
            <motion.div
              animate={{
                rotate: isOnFire ? [-6, 6, -6] : [-4, 4, -4],
                scale: flameScale,
              }}
              transition={{
                repeat: Infinity,
                duration: flameDuration,
                ease: 'easeInOut',
              }}
            >
              <Flame
                size={compact ? 13 : isOnFire ? 17 : 15}
                className={isHot || isOnFire ? 'text-white dark:text-slate-900' : 'text-slate-500'}
              />
            </motion.div>

            <span className={`font-bold tabular-nums ${compact ? 'text-xs' : isOnFire ? 'text-base' : 'text-sm'}`}>
              {label}
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
