import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { spring } from '@/lib/motion';
import { Flame, Zap } from 'lucide-react';
import { getComboLevel } from '@/features/quiz/api/useSpeedQuiz';

/**
 * SpeedQuizCombo — shows the student's current combo streak during speed quiz.
 * Appears when streak >= 1. Shows combo count, multiplier, and fire animation.
 * Positioned as a floating pill at the top of the vote area.
 */
export default memo(function SpeedQuizCombo({ streak = 0 }) {
  const combo = getComboLevel(streak);

  return (
    <AnimatePresence>
      {streak >= 1 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -10 }}
          transition={spring.bouncy}
          className="flex items-center justify-center"
        >
          <motion.div
            key={streak}
            initial={{ scale: 1.35 }}
            animate={{ scale: 1 }}
            transition={spring.stiff}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border shadow-sm ${
              combo.level >= 3
                ? 'bg-slate-900 text-white border-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-200'
                : combo.level >= 2
                  ? 'bg-slate-800 text-white border-slate-900 dark:bg-slate-200 dark:text-slate-900 dark:border-slate-100'
                  : 'bg-white text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
            }`}
          >
            {/* Fire icon */}
            <motion.div
              animate={combo.level >= 3 ? {
                rotate: [-6, 6, -6],
                scale: [1, 1.2, 1],
              } : combo.level >= 2 ? {
                rotate: [-3, 3, -3],
                scale: [1, 1.1, 1],
              } : {}}
              transition={combo.level >= 2 ? {
                repeat: Infinity,
                duration: combo.level >= 3 ? 0.35 : 0.6,
                ease: 'easeInOut',
              } : {}}
            >
              {combo.level >= 2 ? (
                <Flame size={16} className="text-white" />
              ) : (
                <Zap size={14} />
              )}
            </motion.div>

            {/* Combo count */}
            <span className="font-bold text-sm tabular-nums">
              {streak}
              <span className="font-medium text-xs ml-0.5 opacity-70">연속</span>
            </span>

            {/* Multiplier badge */}
            {combo.multiplier > 1 && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-white/20 text-white">
                x{combo.multiplier}
              </span>
            )}

            {/* Level label */}
            {combo.label && (
              <motion.span
                key={combo.label}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-[10px] font-bold tracking-wider opacity-60"
              >
                {combo.label}
              </motion.span>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
