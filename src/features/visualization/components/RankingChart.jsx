import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import NumberBadge from '@/components/ui/NumberBadge';
import { useVotes } from '@/hooks/useVotes';
import { correctRankingOrder, formatRankingSequence, rankingOrdinal, rankingPositionStats } from '@/lib/ranking-answer';
import { settle } from '@/lib/motion';

/**
 * RankingChart — 순위 맞추기 발표/강사 화면.
 *
 * 항목 번호(①②③…)는 고정 이름표. 공개 전에는 번호 카드를 문항마다 고정된 순서로 섞어 균형 잡힌 격자에 둔다.
 * 공개하면 "정답 ① → ③ → ④ → ②" 머리글이 뜨고, 카드가 첫 번째부터 한 장씩(STEP_MS 간격) 정답 목록 자리로 옮겨 간다.
 * 한 줄 = "첫 번째 · ① DNS 조회 · 막대 · 12명 맞힘". 응답이 0명이어도 정답 순서는 그대로 보인다.
 */
const STEP_MS = 350;
const COLUMNS = { 1: 1, 2: 2, 3: 3, 4: 2, 5: 3, 6: 3 };
const boardColumns = (count) => COLUMNS[count] || (count % 3 === 0 ? 3 : 4);

export default memo(function RankingChart({ sessionId, questionId, items = [], correctAnswer, revealed = true, presenter = false }) {
  const { votes } = useVotes(sessionId, questionId);
  const reducedMotion = useReducedMotion();
  const count = items.length;

  const correctOrder = useMemo(() => correctRankingOrder(items, correctAnswer), [items, correctAnswer]);
  const stats = useMemo(() => rankingPositionStats(votes, correctOrder), [votes, correctOrder]);
  // 공개 전에는 강사가 입력한 번호 순서(1, 2, 3, 4) 그대로 보여준다. 정답은 번호와 따로 정하므로 순서가 드러나지 않는다.
  const boardOrder = useMemo(() => items.map((_, i) => i), [items]);

  // 몇 번째 자리까지 옮겨 놓았는지. 공개 순간에만 한 장씩 옮기고, 이미 공개된 채로 열리면 바로 다 놓는다.
  const [placed, setPlaced] = useState(revealed ? count : 0);
  const wasRevealed = useRef(revealed);
  useEffect(() => {
    const previous = wasRevealed.current;
    wasRevealed.current = revealed;
    if (!revealed) { setPlaced(0); return undefined; }
    if (previous || reducedMotion || !presenter) { setPlaced(count); return undefined; }
    setPlaced(0);
    let step = 0;
    const id = setInterval(() => {
      step += 1;
      setPlaced(step);
      if (step >= count) clearInterval(id);
    }, STEP_MS);
    return () => clearInterval(id);
  }, [revealed, count, reducedMotion, presenter]);

  const transition = reducedMotion ? { duration: 0 } : settle;
  const placedSet = new Set(correctOrder.slice(0, placed));
  const pool = boardOrder.filter((index) => !placedSet.has(index));
  const columns = boardColumns(count);
  const badgeSize = presenter ? 'stage' : 'lg';
  const stageClass = presenter ? 'ranking-board-stage' : '';

  return (
    <div data-ranking-board={revealed ? 'answer' : 'shuffled'} data-ranking-placed={placed}
      className={`w-full mx-auto px-4 ${presenter ? `max-w-3xl ${stageClass} space-y-5` : 'max-w-2xl space-y-4'}`}>
      {revealed && (
        <motion.div layout transition={transition} initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2" aria-label={`정답 ${formatRankingSequence(correctOrder, { options: items })}`}>
          <span className={`font-bold text-slate-900 dark:text-slate-100 ${presenter ? 'ranking-count' : 'text-base'}`}>정답</span>
          <ol className="flex flex-wrap items-center justify-center gap-1.5" aria-hidden="true">
            {correctOrder.map((index, position) => (
              <li key={position} className="flex items-center gap-1.5">
                {position > 0 && <ArrowRight className={`shrink-0 text-slate-400 dark:text-slate-500 ${presenter ? 'ranking-arrow' : 'size-4'}`} />}
                <NumberBadge number={index + 1} size={badgeSize} />
              </li>
            ))}
          </ol>
        </motion.div>
      )}

      <LayoutGroup id={`ranking-${questionId}`}>
        {pool.length > 0 && (
          <motion.ul layout transition={transition} className={`flex flex-wrap justify-center ${presenter ? 'gap-3 lg:gap-4' : 'gap-3'}`}
            style={{ '--ranking-columns': columns }} aria-label="항목">
            {pool.map((index) => (
              <motion.li key={index} layoutId={`ranking-${questionId}-${index}`} layout transition={transition}
                initial={revealed || reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className={`ranking-board-card flex items-center rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-600/80 dark:bg-slate-800 ${presenter ? 'gap-3 px-4 py-3.5' : 'gap-3 px-4 py-3'}`}>
                <motion.span layout="position" transition={transition} className="flex"><NumberBadge number={index + 1} size={badgeSize} /></motion.span>
                <motion.span layout="position" transition={transition} className={`min-w-0 font-semibold leading-snug text-slate-900 dark:text-slate-100 [word-break:keep-all] ${presenter ? 'ranking-item-label' : 'text-base'}`}>{items[index]}</motion.span>
              </motion.li>
            ))}
          </motion.ul>
        )}

        {revealed && placed > 0 && (
          <motion.ol layout transition={transition} className={presenter ? 'space-y-3' : 'space-y-2.5'} aria-label="정답 순서">
            {stats.positions.slice(0, placed).map(({ position, itemIndex, correct, pct }) => (
              <motion.li key={itemIndex} layoutId={`ranking-${questionId}-${itemIndex}`} layout transition={transition}
                className={`grid items-center rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-600/80 dark:bg-slate-800 ${presenter ? 'grid-cols-[auto_auto_minmax(0,1.3fr)_minmax(0,1fr)_auto] gap-x-4 px-4 py-3' : 'grid-cols-[auto_auto_minmax(0,1fr)_auto] gap-x-3 px-4 py-3'}`}>
                <motion.span layout="position" transition={transition} className={`whitespace-nowrap font-medium text-slate-500 dark:text-slate-400 ${presenter ? 'ranking-ordinal' : 'text-xs'}`}>{rankingOrdinal(position)}</motion.span>
                <motion.span layout="position" transition={transition} className="flex"><NumberBadge number={itemIndex + 1} size={badgeSize} /></motion.span>
                <motion.span layout="position" transition={transition} className={`min-w-0 font-semibold leading-snug text-slate-900 dark:text-slate-100 [word-break:keep-all] ${presenter ? 'ranking-item-label' : 'text-base'}`}>{items[itemIndex]}</motion.span>
                <motion.div initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: reducedMotion ? 0 : 0.2 }}
                  className={`overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700 ${presenter ? 'h-3 lg:h-3.5' : 'col-span-4 row-start-2 mt-2.5 h-2'}`}
                  role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${rankingOrdinal(position)} 자리를 맞힌 비율 ${pct}%`}>
                  <motion.div className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400" initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                    transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 200, damping: 24, delay: 0.25 }} />
                </motion.div>
                <motion.span layout="position" initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: reducedMotion ? 0 : 0.2 }}
                  className={`whitespace-nowrap tabular-nums text-slate-500 dark:text-slate-400 ${presenter ? 'ranking-count' : 'col-start-4 row-start-1 text-sm'}`}>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{correct}명</span> 맞힘
                </motion.span>
              </motion.li>
            ))}
          </motion.ol>
        )}
      </LayoutGroup>

      {revealed ? (placed >= count && (
        <motion.p layout transition={transition} initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }}
          className={`text-center text-slate-600 dark:text-slate-300 ${presenter ? 'ranking-note' : 'text-sm'}`}>
          순서를 모두 맞힌 학생 <span className={`font-bold tabular-nums text-slate-900 dark:text-slate-100 ${presenter ? 'ranking-count-strong' : 'text-lg'}`}>{stats.perfectCount}명</span>
          <span className="text-slate-400"> / {stats.totalVoters}명</span>
        </motion.p>
      )) : (
        <p className={`text-center text-slate-600 dark:text-slate-300 ${presenter ? 'ranking-note' : 'text-sm'}`}>
          <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">{stats.totalVoters}명</span> 제출 · 번호를 정답 순서대로 맞춰보세요
        </p>
      )}
    </div>
  );
});
