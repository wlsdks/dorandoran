import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useVotes } from '@/hooks/useVotes';
import { grow, spring } from '@/lib/motion';

const LEVELS = [
  { key: 'high', label: '확신', color: 'bg-slate-800 dark:bg-slate-200' },
  { key: 'medium', label: '보통', color: 'bg-slate-400 dark:bg-slate-400' },
  { key: 'low', label: '확신 없음', color: 'bg-slate-200 dark:bg-slate-600' },
];

/**
 * Confidence distribution bar for quiz questions.
 * Shows how confident students were in their answers.
 */
export default memo(function ConfidenceStats({ sessionId, questionId }) {
  const { votes } = useVotes(sessionId, questionId);

  const stats = useMemo(() => {
    const counts = { high: 0, medium: 0, low: 0 };
    let total = 0;
    Object.values(votes || {}).forEach((v) => {
      if (v.confidence) {
        counts[v.confidence] = (counts[v.confidence] || 0) + 1;
        total++;
      }
    });
    return { counts, total };
  }, [votes]);

  if (stats.total === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring.default, delay: 0.3 }}
      className="mt-4 px-4 max-w-xl mx-auto"
    >
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
        응답 자신감
      </p>
      <div className="flex items-center gap-1 h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700">
        {LEVELS.map(({ key, color }) => {
          const pct = stats.total > 0 ? (stats.counts[key] / stats.total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <motion.div
              key={key}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ ...grow, delay: 0.4 }}
              className={`h-full ${color} first:rounded-l-full last:rounded-r-full`}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        {LEVELS.map(({ key, label, color }) => {
          const count = stats.counts[key];
          if (count === 0) return null;
          return (
            <span key={key} className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
              <span className={`w-2 h-2 rounded-full ${color}`} />
              {label} {Math.round((count / stats.total) * 100)}%
            </span>
          );
        })}
      </div>
    </motion.div>
  );
});
