import { memo } from 'react';
import { motion } from 'framer-motion';
import { spring } from '@/lib/motion';
import { Zap } from 'lucide-react';

/**
 * SpeedQuizBanner — shown on student screen during speed quiz mode.
 * Minimal pill indicating speed quiz is active + question counter.
 */
export default memo(function SpeedQuizBanner({ currentIndex, totalQuestions }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.default}
      className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl px-4 py-3 flex items-center justify-between"
    >
      <div className="flex items-center gap-2">
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
        >
          <Zap size={16} />
        </motion.div>
        <span className="text-sm font-bold">스피드 퀴즈</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs opacity-60">
          <span className="font-bold opacity-100 tabular-nums">{currentIndex}</span>
          <span className="opacity-40">/{totalQuestions}</span>
        </span>
        <div className="flex gap-0.5">
          {Array.from({ length: totalQuestions }).map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${
                i < currentIndex ? 'bg-white dark:bg-slate-900' : 'bg-white/20 dark:bg-slate-900/20'
              }`}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
});
