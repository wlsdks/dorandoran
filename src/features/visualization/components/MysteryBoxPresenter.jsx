import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Trophy } from 'lucide-react';
import { useVotes } from '@/hooks/useVotes';
import Avatar from '@/components/ui/Avatar';
import { useEffect, useRef, useMemo } from 'react';

const SPRING_BOUNCY = { type: 'spring', stiffness: 400, damping: 22 };

export default memo(function MysteryBoxPresenter({ sessionId, questionId, question, revealed }) {
  const { totalVotes } = useVotes(sessionId, questionId);
  const items = useMemo(() => question?.mysteryItems?.length > 0 ? question.mysteryItems : ['?', '??', '???'], [question?.mysteryItems]);
  const answer = question?.correctAnswer || '';
  const reasons = question?.answerReasons || [];

  // 미리 입력된 당첨자
  const presetWinners = question?.winners || [];
  const revealedWinners = question?.revealedWinners || 0;
  const visibleWinners = presetWinners.slice(0, revealedWinners);

  const textRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!revealed && items.length > 0) {
      let idx = 0;
      intervalRef.current = setInterval(() => {
        if (textRef.current) {
          textRef.current.textContent = items[idx % items.length];
          idx++;
        }
      }, 120);
    }
    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, [revealed, items]);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto px-4">
      <AnimatePresence mode="wait">
        {!revealed ? (
          <motion.div
            key="spinning"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={SPRING_BOUNCY}
            className="relative"
          >
            <motion.div
              animate={{ y: [0, -6, 0], scale: [1, 1.01, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              className="w-48 h-48 md:w-64 md:h-64 rounded-3xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 shadow-lg flex flex-col items-center justify-center overflow-hidden"
            >
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5], scale: [0.95, 1.05, 0.95] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <HelpCircle size={40} className="text-slate-300 dark:text-slate-300" />
              </motion.div>
              <span
                ref={textRef}
                className="text-2xl md:text-3xl font-bold text-slate-400 dark:text-slate-300 tabular-nums min-h-[2.5rem] text-center px-4 mt-2"
              >?</span>
            </motion.div>

            <motion.div
              className="absolute inset-0 rounded-3xl border border-slate-200/50 dark:border-slate-600/50"
              animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeOut' }}
            />

            {totalVotes > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-sm text-slate-400 dark:text-slate-300 whitespace-nowrap"
              >
                {totalVotes}명 답변 중
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="revealed"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
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
            {reasons.length > 0 && (
              <div className="mt-4 space-y-1">
                {reasons.map((r, i) => (
                  <motion.p
                    key={i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + i * 0.15 }}
                    className="text-sm text-white/60 dark:text-slate-600"
                  >{r}</motion.p>
                ))}
              </div>
            )}

            {totalVotes > 0 && visibleWinners.length === 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
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
