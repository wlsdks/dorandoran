import { isAutoPhotoName } from '@/lib/option-images';
import { memo } from 'react';
import { motion } from 'framer-motion';
import { grow, spring } from '@/lib/motion';
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
export default memo(function StudentLiveResults({ sessionId, questionId, options, myAnswer, revealed = false, images = null, correctValue = null }) {
  const { connected } = useConnectionStatus();
  const { totalVotes, countByValue, resultsHidden, loading } = useVotes(sessionId, questionId);

  if (resultsHidden || loading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring.default, delay: 0.4 }}
      className="w-full rounded-xl bg-white dark:bg-slate-800 p-4 shadow-sm space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-tight">
          {connected ? '전체 선택 비율' : '마지막 집계 · 연결 복구 대기'} {connected && !revealed && <span className="font-normal text-slate-600 dark:text-slate-400">· 실시간</span>}
        </p>
        <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
          <Users size={12} />
          <span className="text-xs font-semibold tabular-nums">{totalVotes}</span>
        </div>
      </div>

      <div className="space-y-2">
        {options.map((option, index) => {
          const count = countByValue(option);
          const proportion = totalVotes > 0 ? count / totalVotes : 0;
          const isMine = option === myAnswer;
          // 정답 공개 뒤: 정답 행은 answer-glow로 빛나고 나머지는 가라앉는다(막대도 정답만 인디고)
          const isCorrect = revealed && correctValue != null && option === correctValue;
          const dimmed = revealed && correctValue != null && !isCorrect;
          const emphasized = isCorrect || (isMine && !dimmed);

          return (
            <div key={option} className={`student-result-row space-y-1 ${isCorrect ? 'answer-glow' : dimmed ? 'answer-dim' : ''}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={`text-sm break-words ${
                    emphasized
                      ? 'font-semibold text-slate-900 dark:text-slate-100'
                      : 'font-medium text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {images?.[index] && <img src={images[index]} alt="" className="mr-2 inline-block h-8 w-8 rounded-md object-contain bg-slate-100 dark:bg-slate-900 align-middle" />}<span className="font-semibold mr-2">{String.fromCharCode(65 + index)}</span>{images?.[index] && isAutoPhotoName(option) ? null : option}
                  {isCorrect && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 align-middle text-xs font-bold text-indigo-600 dark:text-indigo-300"><Check size={12} strokeWidth={3} />정답</span>
                  )}
                  {isMine && !isCorrect && (
                    <Check size={12} className="inline ml-1 text-slate-500 dark:text-slate-400" />
                  )}
                </span>
                <span
                  className={`text-xs tabular-nums shrink-0 ${
                    emphasized ? 'font-bold text-slate-900 dark:text-slate-100' : 'font-medium text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {formatPercent(count, totalVotes)}
                </span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: proportion }}
                  transition={grow}
                  className={`h-full w-full origin-left rounded-full ${
                    isCorrect || (isMine && !dimmed) ? 'bg-indigo-500 dark:bg-indigo-400' : 'bg-slate-200 dark:bg-slate-600'
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
