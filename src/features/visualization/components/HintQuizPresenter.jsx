import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, Trophy } from 'lucide-react';
import { useVotes } from '@/hooks/useVotes';
import Avatar from '@/components/ui/Avatar';

const SPRING = { type: 'spring', stiffness: 300, damping: 25 };
const SPRING_BOUNCY = { type: 'spring', stiffness: 400, damping: 22 };

export default memo(function HintQuizPresenter({ sessionId, questionId, question, revealed }) {
  const { totalVotes } = useVotes(sessionId, questionId);
  const hints = question?.hints || [];
  const revealedHints = question?.revealedHints || 0;
  const answer = question?.correctAnswer || '';
  const maxHints = Math.min(hints.length, 5);

  // 미리 입력된 당첨자
  const presetWinners = question?.winners || [];
  const revealedWinners = question?.revealedWinners || 0;
  const visibleWinners = presetWinners.slice(0, revealedWinners);

  return (
    <div className="hint-quiz-stage flex flex-col items-center gap-6 w-full max-w-2xl mx-auto px-4 pt-4">
      {!revealed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2"
        >
          <Lightbulb size={18} className="text-slate-400 dark:text-slate-300" />
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
            힌트 {revealedHints}/{maxHints}
          </span>
          {totalVotes > 0 && (
            <span className="text-sm text-slate-400 dark:text-slate-300 ml-2">· {totalVotes}명 답변 중</span>
          )}
        </motion.div>
      )}

      {!revealed && (
        <div className="w-full space-y-3">
          {hints.slice(0, maxHints).map((hint, i) => {
            const isRevealed = i < revealedHints;
            return (
              <AnimatePresence key={i}>
                {isRevealed ? (
                  <motion.div
                    initial={{ opacity: 0, x: -20, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ ...SPRING, delay: 0.05 }}
                    className="flex items-start gap-3 p-4 md:p-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm"
                  >
                    <span className="w-7 h-7 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center text-sm font-bold shrink-0">
                      {i + 1}
                    </span>
                    <p className="text-base md:text-lg font-medium text-slate-700 dark:text-slate-200 leading-relaxed pt-0.5">
                      {hint}
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.5 }}
                    className="flex items-center gap-3 p-4 md:p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700"
                  >
                    <span className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-300 flex items-center justify-center text-sm font-bold shrink-0">
                      {i + 1}
                    </span>
                    <p className="text-base text-slate-300 dark:text-slate-300">???</p>
                  </motion.div>
                )}
              </AnimatePresence>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {revealed && (
          <motion.div
            key="answer"
            initial={{ scale: 0.5, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={SPRING_BOUNCY}
            className="classroom-revealed-answer relative w-full rounded-2xl bg-slate-900 dark:bg-indigo-900 p-10 md:p-14 text-center shadow-2xl shadow-slate-900/20 overflow-hidden"
          >
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xs font-semibold text-white/70 dark:text-slate-300 uppercase tracking-wider mb-3"
            >
              정답
            </motion.p>
            <motion.p
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: [0.8, 1.1, 0.95, 1.02, 1] }}
              transition={{ ...SPRING_BOUNCY, delay: 0.3 }}
              className="text-4xl md:text-6xl font-bold text-white dark:text-slate-100 tracking-tight"
            >
              {answer}
            </motion.p>

            {totalVotes > 0 && visibleWinners.length === 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-4 text-sm text-white/50 dark:text-slate-300"
              >
                {totalVotes}명 참여
              </motion.p>
            )}

            {/* 당첨자 — 한 명씩 공개 */}
            {visibleWinners.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-6 pt-5 border-t border-white/10 dark:border-slate-200"
              >
                <div className="flex items-center justify-center gap-1.5 mb-4">
                  <Trophy size={16} className="text-amber-400 dark:text-amber-500" />
                  <span className="text-xs font-semibold text-white/70 dark:text-slate-300 uppercase tracking-wider">
                    당첨자
                  </span>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <AnimatePresence>
                    {visibleWinners.map((name, i) => (
                      <motion.div
                        key={`winner-${i}`}
                        initial={{ opacity: 0, scale: 0, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ ...SPRING_BOUNCY, delay: 0.1 }}
                        className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white/15 dark:bg-slate-900/10"
                      >
                        <span className="w-6 h-6 rounded-full bg-amber-400 dark:bg-amber-500 text-amber-950 flex items-center justify-center text-xs font-bold">
                          {i + 1}
                        </span>
                        <Avatar name={name} size="sm" />
                        <span className="text-lg font-bold text-white dark:text-slate-100">{name}</span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
