import { memo } from 'react';
import { motion } from 'framer-motion';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { useVotes } from '@/hooks/useVotes';
import { formatPercent } from '@/lib/utils';
import { Users, Check } from 'lucide-react';

/**
 * Compact live poll results for student phones.
 * Shows animated horizontal bars with real-time vote counts.
 * Highlights the student's own selection.
 *
 * @param {Object} props
 * @param {string} props.sessionId
 * @param {string} props.questionId
 * @param {string[]} props.options - vote option labels
 * @param {string} props.myAnswer - the option this student voted for
 */
export default memo(function StudentLiveResults({ sessionId, questionId, options, myAnswer, revealed = false }) {
  const { connected } = useConnectionStatus();
  const { totalVotes, countByValue, resultsHidden, loading } = useVotes(sessionId, questionId);

  if (resultsHidden || loading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, type: 'spring', stiffness: 300, damping: 25 }}
      className="w-full rounded-xl bg-white dark:bg-slate-800 p-4 shadow-sm space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-tight">
          {connected ? '전체 선택 비율' : '마지막 집계 · 연결 복구 대기'} {!revealed && <span className="font-normal text-slate-400 dark:text-slate-500">· 실시간</span>}
        </p>
        <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
          <Users size={12} />
          <span className="text-xs font-semibold tabular-nums">{totalVotes}</span>
        </div>
      </div>

      <div className="space-y-2">
        {options.map((option, index) => {
          const count = countByValue(option);
          const proportion = totalVotes > 0 ? count / totalVotes : 0;
          const isMine = option === myAnswer;

          return (
            <div key={option} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={`text-sm break-words ${
                    isMine
                      ? 'font-semibold text-slate-900 dark:text-slate-100'
                      : 'font-medium text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <span className="font-semibold mr-2">{String.fromCharCode(65 + index)}</span>{option}
                  {isMine && (
                    <Check size={12} className="inline ml-1 text-slate-500 dark:text-slate-400" />
                  )}
                </span>
                <span
                  className={`text-xs tabular-nums shrink-0 ${
                    isMine ? 'font-bold text-slate-900 dark:text-slate-100' : 'font-medium text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {formatPercent(count, totalVotes)}
                </span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: proportion }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  className={`h-full w-full origin-left rounded-full ${
                    isMine ? 'bg-indigo-500 dark:bg-indigo-400' : 'bg-slate-200 dark:bg-slate-600'
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
});
