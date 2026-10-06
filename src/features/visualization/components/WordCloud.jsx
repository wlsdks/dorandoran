import { useVotes } from '@/hooks/useVotes';
import { useState, memo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import { arrangeWordCloud, layoutWordLines, wordSizeStep, wordCloudScale } from '@/lib/wordcloud-layout';
import { settle, reveal, exitTween } from '@/lib/motion';
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
const PRESENTER_LIMIT = 30;
const PHONE_LIMIT = 40;

/**
 * 단어는 처음 나타난 자리를 지키고 크기만 자란다 — 200명이 답하는 동안 구름이 매번 튀지 않는다.
 * 집계(tallied)가 바뀔 때만 직전 배치를 이어받아 다시 배치한다(렌더 중 파생 상태 갱신).
 * 폰은 한 줄 흐름(flex-wrap), 전자칠판은 줄 단위 배치(새 단어는 가장 짧은 줄 끝에).
 */
function useStableCloud(tallied, presenter) {
  const [state, setState] = useState({ tallied: null, presenter: null, words: EMPTY, lines: EMPTY });
  if (state.tallied !== tallied || state.presenter !== presenter) {
    const next = presenter
      ? { lines: layoutWordLines(state.lines.map((line) => line.map((word) => word.text)), tallied, { limit: PRESENTER_LIMIT }), words: EMPTY }
      : { words: arrangeWordCloud(state.words.map((word) => word.text), tallied, PHONE_LIMIT), lines: EMPTY };
    setState({ tallied, presenter, ...next });
    return next;
  }
  return state;
}

/**
 * 전자칠판 단어 — 크기 단계가 바뀌면 글자 상자는 한 번 바뀌고(5단계라 드물다), 눈에 보이는 성장은
 * transform scale로 잇는다. 자리 이동은 layout(transform)로 미끄러진다.
 */
function StageWord({ word, step, reduced }) {
  const [track, setTrack] = useState({ step, from: step });
  if (track.step !== step) setTrack({ step, from: track.step });
  const sizeOf = (s) => 1.6 + 3 * s;
  const ratio = track.step === step ? sizeOf(track.from) / sizeOf(step) : 1;
  const fontSize = `clamp(1.3rem, calc(var(--wc-scale) * min(${sizeOf(step).toFixed(2)}vw, ${Math.floor(860 / Math.max(1, word.text.length))}px)), 4.6rem)`;
  return (
    <motion.span
      layout={reduced ? false : 'position'}
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.5, transition: exitTween }}
      transition={reduced ? { duration: 0.12 } : { ...reveal, layout: settle }}
      style={{ fontSize }}
      className="wordcloud-token-stage font-bold cursor-default"
      title={`${word.text}: ${word.count}회`}
    >
      <motion.span key={step} className="inline-block origin-center" initial={reduced || ratio === 1 ? false : { scale: ratio }} animate={{ scale: 1 }} transition={reveal}>
        {word.text}
      </motion.span>
    </motion.span>
  );
}

export default memo(function WordCloud({ sessionId, questionId, presenter = false }) {
  const { tally, totalVotes } = useVotes(sessionId, questionId);
  const reduced = useReducedMotion();
  const tallied = tally();
  const { words, lines } = useStableCloud(tallied, presenter);
  const distinct = Object.keys(tallied).length;

  const shown = presenter ? lines.flat() : words;
  const maxCount = Math.max(...shown.map((w) => w.count), 1);
  const isNarrow = typeof window !== 'undefined' && window.innerWidth < 640;

  // 크기는 6단계로 끊는다 — 응답 하나마다 전부 미세하게 줄 바꿈되지 않고, 단계가 바뀔 때만 자란다.
  // 긴 단어는 한 줄 폭(한글 한 글자 ≈ 1em)에 들어가도록 상한을 둔다. 읽을 수 있는 최소 크기는 지킨다.
  function getFontSize(count, text) {
    const min = isNarrow ? 18 : 24;
    const max = isNarrow ? 40 : 68;
    const size = min + wordSizeStep(count, maxCount) * (max - min);
    return Math.max(min, Math.min(size, (isNarrow ? 300 : 640) / Math.max(1, text.length)));
  }

  const empty = (
    <div className="text-center space-y-2 flex flex-col items-center">
      <DoranDoranMascot size={presenter ? 180 : 'sm'} mood="waiting" />
      <p className={presenter ? "text-slate-200 text-3xl lg:text-4xl font-semibold" : "text-slate-400 dark:text-slate-500 text-base"}>여러분의 생각을 기다리고 있어요</p>
      {presenter && <p className="text-slate-300 text-xl lg:text-2xl">휴대폰에 한 단어를 적어주세요</p>}
    </div>
  );

  if (presenter) {
    // 단어가 늘수록 전체 글자 배율이 줄어 구름이 세로로 자라지 않고 타원 덩어리로 남는다. 무대 높이는 고정(1080p·768p 모두 들어간다).
    const scale = wordCloudScale(shown.length);
    return (
      <div className="w-full classroom-results">
        <div className="wordcloud-stage" data-words={shown.length} data-lines={lines.length}>
          {/* 빈 상태는 겹쳐 두고, 구름은 무대를 꽉 채운 상자 안에서 줄만 transform으로 자리를 잡는다 — 레이아웃 시프트 없이 */}
          <AnimatePresence initial={false}>
            {lines.length === 0 && <motion.div key="empty" className="absolute inset-0 flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: exitTween }}>{empty}</motion.div>}
          </AnimatePresence>
          <div className="wordcloud-cloud" style={{ '--wc-scale': scale }}>
            {lines.map((line, index) => (
              <motion.div key={index} layout={reduced ? false : 'position'} transition={settle} className="wordcloud-line">
                <AnimatePresence initial={false}>
                  {line.map((word) => <StageWord key={word.text} word={word} step={wordSizeStep(word.count, maxCount)} reduced={reduced} />)}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
        {/* 자리는 늘 잡아둔다 — 첫 응답에서 한 줄이 생기며 무대 전체가 위로 밀리지 않게 */}
        <div className="text-center text-slate-300 text-xl mt-3 min-h-[1.75em]" aria-live="polite">
          {totalVotes > 0 && <>총 {totalVotes}개 응답{distinct > PRESENTER_LIMIT && ` · 주요 ${PRESENTER_LIMIT}개 표시, 외 ${distinct - PRESENTER_LIMIT}개`}</>}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="flex flex-wrap content-center items-center justify-center gap-x-4 gap-y-2.5 p-6 min-h-[300px]">
        <AnimatePresence initial={false}>
          {words.map((word) => (
            // 순서는 고정 — 새 단어만 바깥쪽 끝에서 피어나고, 크기는 CSS transition으로 자란다. 폰(40단어)은 layout 비용을 아낀다.
            <motion.span
              key={word.text}
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
              transition={reduced ? { duration: 0.12 } : reveal}
              style={{ fontSize: getFontSize(word.count, word.text) }}
              className={`wordcloud-token font-bold cursor-default max-w-full break-keep [overflow-wrap:anywhere] ${WORD_CLASSES[word.rank % WORD_CLASSES.length]}`}
              title={`${word.text}: ${word.count}회`}
            >
              {word.text}
            </motion.span>
          ))}
        </AnimatePresence>
        {words.length === 0 && empty}
      </div>
      {totalVotes > 0 && (
        <div className="text-center text-slate-400 dark:text-slate-500 text-sm mt-2">총 {totalVotes}개 응답</div>
      )}
    </div>
  );
});
