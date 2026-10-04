import { useVotes } from '@/hooks/useVotes';
import { useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
// Monochromatic slate palette — Tailwind classes for dark mode support
const WORD_CLASSES = [
  'text-slate-900 dark:text-slate-100',
  'text-slate-800 dark:text-slate-200',
  'text-slate-700 dark:text-slate-300',
  'text-slate-600 dark:text-slate-400',
  'text-slate-500 dark:text-slate-400',
  'text-slate-400 dark:text-slate-500',
  'text-slate-700 dark:text-slate-300',
  'text-slate-600 dark:text-slate-400',
];

export default memo(function WordCloud({ sessionId, questionId }) {
  const { tally, totalVotes } = useVotes(sessionId, questionId);
  const tallied = tally();

  const words = useMemo(() => {
    return Object.entries(tallied)
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 40);
  }, [tallied]);

  const maxCount = Math.max(...words.map(w => w.count), 1);
  const isNarrow = typeof window !== 'undefined' && window.innerWidth < 640;

  function getFontSize(count) {
    const min = isNarrow ? 18 : 24;
    const max = isNarrow ? 40 : 68;
    return min + ((count / maxCount) * (max - min));
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2.5 p-6 min-h-[300px]"
      >
        <AnimatePresence initial={false}>
          {words.map((word, i) => (
            // layout(FLIP) 제거 — 매 집계 갱신마다 40단어 전체 위치 재계산 reflow 방지. enter/exit만 유지
            <motion.span
              key={word.text}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22, delay: Math.min(i, 12) * 0.008 }}
              style={{ fontSize: getFontSize(word.count) }}
              className={`font-bold cursor-default max-w-full break-keep ${WORD_CLASSES[i % WORD_CLASSES.length]}`}
              title={`${word.text}: ${word.count}회`}
            >
              {word.text}
            </motion.span>
          ))}
        </AnimatePresence>
        {words.length === 0 && (
          <div className="text-center space-y-2 flex flex-col items-center">
            <DoranDoranMascot size="sm" />
            <p className="text-slate-400 dark:text-slate-500 text-base">아직 입력이 없습니다</p>
          </div>
        )}
      </div>
      {totalVotes > 0 && (
        <div className="text-center text-slate-400 dark:text-slate-500 text-sm mt-2">
          총 {totalVotes}개 응답
        </div>
      )}
    </div>
  );
});
