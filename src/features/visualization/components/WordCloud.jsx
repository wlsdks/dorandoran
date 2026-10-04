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

export default memo(function WordCloud({ sessionId, questionId, presenter = false }) {
  const { tally, totalVotes } = useVotes(sessionId, questionId);
  const tallied = tally();

  const words = useMemo(() => {
    return Object.entries(tallied)
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, presenter ? 12 : 40);
  }, [tallied, presenter]);

  const maxCount = Math.max(...words.map(w => w.count), 1);
  const isNarrow = typeof window !== 'undefined' && window.innerWidth < 640;

  function getFontSize(count) {
    const min = isNarrow ? 18 : 24;
    const max = isNarrow ? 40 : 68;
    return min + ((count / maxCount) * (max - min));
  }

  return (
    <div className={presenter ? "w-full classroom-results" : "w-full max-w-3xl mx-auto"}>
      <div
        className={`flex flex-wrap items-center justify-center ${presenter ? 'gap-x-8 gap-y-5 min-h-[40dvh] p-4' : 'gap-x-4 gap-y-2.5 p-6 min-h-[300px]'}`}
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
              style={{ fontSize: presenter ? `clamp(2rem, ${2 + 3 * word.count / maxCount}vw, 6rem)` : getFontSize(word.count) }}
              className={`wordcloud-token font-bold cursor-default max-w-full break-keep ${WORD_CLASSES[i % WORD_CLASSES.length]}`}
              title={`${word.text}: ${word.count}회`}
            >
              {word.text}
            </motion.span>
          ))}
        </AnimatePresence>
        {words.length === 0 && (
          <div className="text-center space-y-2 flex flex-col items-center">
            <DoranDoranMascot size={presenter ? 180 : 'sm'} mood="waiting" />
            <p className={presenter ? "text-slate-200 text-3xl lg:text-4xl font-semibold" : "text-slate-400 dark:text-slate-500 text-base"}>여러분의 생각을 기다리고 있어요</p>
            {presenter && <p className="text-slate-300 text-xl lg:text-2xl">휴대폰에 한 단어를 적어주세요</p>}
          </div>
        )}
      </div>
      {totalVotes > 0 && (
        <div className={presenter ? "text-center text-slate-300 text-xl mt-4" : "text-center text-slate-400 dark:text-slate-500 text-sm mt-2"}>
          총 {totalVotes}개 응답{presenter && Object.keys(tallied).length > 12 && ` · 주요 12개 표시, 외 ${Object.keys(tallied).length - 12}개`}
        </div>
      )}
    </div>
  );
});
