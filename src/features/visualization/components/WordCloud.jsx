import { useVotes } from '@/hooks/useVotes';
import { useState, memo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import { arrangeWordCloud } from '@/lib/wordcloud-layout';
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
const EMPTY = Object.freeze([]);

/**
 * 단어는 처음 나타난 자리를 지키고 크기만 자란다 — 200명이 답하는 동안 구름이 매번 튀지 않는다.
 * 집계(tallied)가 바뀔 때만 직전 순서를 이어받아 다시 배치한다(렌더 중 파생 상태 갱신).
 */
function useStableWords(tallied, limit) {
  const [state, setState] = useState({ tallied: null, limit: 0, words: EMPTY });
  if (state.tallied !== tallied || state.limit !== limit) {
    const words = arrangeWordCloud(state.words.map((word) => word.text), tallied, limit);
    setState({ tallied, limit, words });
    return words;
  }
  return state.words;
}

export default memo(function WordCloud({ sessionId, questionId, presenter = false }) {
  const { tally, totalVotes } = useVotes(sessionId, questionId);
  const reduced = useReducedMotion();
  const tallied = tally();
  const words = useStableWords(tallied, presenter ? 12 : 40);

  const maxCount = Math.max(...words.map(w => w.count), 1);
  const isNarrow = typeof window !== 'undefined' && window.innerWidth < 640;

  // 긴 단어는 한 줄 폭(한글 한 글자 ≈ 1em)에 들어가도록 상한을 둔다. 읽을 수 있는 최소 크기는 지킨다.
  function getFontSize(count, text) {
    const min = isNarrow ? 18 : 24;
    const max = isNarrow ? 40 : 68;
    const size = min + ((count / maxCount) * (max - min));
    return Math.max(min, Math.min(size, (isNarrow ? 300 : 640) / Math.max(1, text.length)));
  }

  return (
    <div className={presenter ? "w-full classroom-results" : "w-full max-w-3xl mx-auto"}>
      <div
        className={`flex flex-wrap content-center items-center justify-center ${presenter ? 'gap-x-8 gap-y-3 min-h-[40dvh] p-4 max-w-4xl mx-auto' : 'gap-x-4 gap-y-2.5 p-6 min-h-[300px]'}`}
      >
        <AnimatePresence initial={false}>
          {words.map((word) => (
            // 자리는 고정(FLIP 없음) — 새 단어만 바깥쪽 끝에서 피어나고, 크기는 CSS transition으로 자란다
            <motion.span
              key={word.text}
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
              transition={reduced ? { duration: 0.12 } : { type: 'spring', stiffness: 260, damping: 22 }}
              style={{ fontSize: presenter ? `clamp(1.5rem, min(${1.6 + 4 * word.count / maxCount}vw, ${Math.floor(860 / Math.max(1, word.text.length))}px), 6.5rem)` : getFontSize(word.count, word.text) }}
              className={`wordcloud-token font-bold cursor-default max-w-full break-keep [overflow-wrap:anywhere] ${WORD_CLASSES[word.rank % WORD_CLASSES.length]}`}
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
