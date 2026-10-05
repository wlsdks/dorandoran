import { memo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { HelpCircle, Trophy } from 'lucide-react';
import { useVotes } from '@/hooks/useVotes';
import Avatar from '@/components/ui/Avatar';
import { useMemo } from 'react';

export default memo(function MysteryBoxPresenter({ sessionId, questionId, question, revealed }) {
  const { totalVotes } = useVotes(sessionId, questionId);
  const reduced = useReducedMotion();
  const transition = { duration: reduced ? 0 : 0.2, ease: 'easeOut' };
  const items = useMemo(() => question?.mysteryItems?.length > 0 ? question.mysteryItems : ['?', '??', '???'], [question?.mysteryItems]);
  const answer = question?.correctAnswer || '';
  const reasons = question?.answerReasons || [];

  // 미리 입력된 당첨자
  const presetWinners = question?.winners || [];
  const revealedWinners = question?.revealedWinners || 0;
  const visibleWinners = presetWinners.slice(0, revealedWinners);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto px-4">
      <AnimatePresence mode="wait">
        {!revealed ? (
          <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={transition} className="mystery-options w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-5 md:p-7">
            <div className="flex items-center justify-center gap-3 text-slate-700 dark:text-slate-200">
              <HelpCircle size={28} aria-hidden="true" />
              <p className="text-xl font-semibold">어떤 키워드일까요?</p>
            </div>
            <ul className="mystery-option-list mt-5 flex flex-wrap justify-center gap-3" aria-label="후보 키워드">
              {items.map((item, i) => <li key={i} className="rounded-xl bg-white dark:bg-slate-700 px-5 py-3 text-xl font-semibold text-slate-700 dark:text-slate-100">
                {item}
              </li>)}
            </ul>
            <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-300">
              휴대폰에서 예상하는 답을 적어주세요{totalVotes > 0 && <> · {totalVotes}명 응답</>}
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="revealed"
            initial={{ opacity: 0, y: reduced ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transition}
            className="classroom-revealed-answer relative w-full rounded-2xl bg-slate-900 dark:bg-indigo-900 p-10 md:p-14 text-center shadow-2xl shadow-slate-900/20 overflow-hidden"
          >
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={transition}
              className="text-xs font-semibold text-white/70 dark:text-slate-300 uppercase tracking-wider mb-3"
            >
              정답
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={transition}
              className="text-4xl md:text-6xl font-bold text-white dark:text-slate-100 tracking-tight"
            >
              {answer}
            </motion.p>
            {reasons.length > 0 && (
              <div className="mt-4 space-y-1">
                {reasons.map((r, i) => (
                  <motion.p
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={transition}
                    className="text-sm text-white/80 dark:text-slate-200"
                  >{r}</motion.p>
                ))}
              </div>
            )}

            {totalVotes > 0 && visibleWinners.length === 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={transition}
                className="mt-4 text-sm text-white/50 dark:text-slate-300"
              >
                {totalVotes}명 참여
              </motion.p>
            )}

            {/* 당첨자 — 한 명씩 공개 */}
            {visibleWinners.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, y: 0 }}
                transition={transition}
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
                        initial={{ opacity: 0, y: reduced ? 0 : 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={transition}
                        className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white/15 dark:bg-slate-900/10"
                      >
                        <span className="w-6 h-6 rounded-full bg-amber-400 dark:bg-amber-500 text-white dark:text-slate-100 flex items-center justify-center text-xs font-bold">
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
