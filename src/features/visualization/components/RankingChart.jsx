import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useVotes } from '@/hooks/useVotes';
import { boardRankingOrder } from '@/lib/ranking-order';

/**
 * RankingChart — instructor visualization for ranking questions.
 *
 * 공개 전: 섞인 항목(번호 없음). 공개 후: 정답 순서 목록 + 자리별 맞힌 학생 수 + 전부 맞힌 학생 수.
 */
export default memo(function RankingChart({ sessionId, questionId, items = [], revealed = true, presenter = false }) {
  const { votes } = useVotes(sessionId, questionId);

  const analysis = useMemo(() => {
    const voteEntries = Object.values(votes || {});
    const totalVoters = voteEntries.length;
    // 응답이 0명이어도 정답 공개 화면에는 정답 순서가 나와야 한다 — 맞힌 수 0으로 채운다.
    if (totalVoters === 0 || items.length === 0) {
      return { totalVoters: 0, positionAccuracy: items.map((item, i) => ({ position: i + 1, item, correct: 0, total: 0, pct: 0 })), perfectCount: 0, avgScore: 0 };
    }

    // correctOrder is 0,1,2,3,... (items are stored in correct order)
    const correctOrder = items.map((_, i) => i);
    const positionCorrect = new Array(items.length).fill(0);
    let perfectCount = 0;
    let totalCorrectPositions = 0;

    voteEntries.forEach((vote) => {
      const studentOrder = (vote.value || '').split(',').map(Number);
      let allCorrect = true;

      studentOrder.forEach((itemIdx, position) => {
        if (position < correctOrder.length && itemIdx === correctOrder[position]) {
          positionCorrect[position]++;
          totalCorrectPositions++;
        } else {
          allCorrect = false;
        }
      });

      if (allCorrect && studentOrder.length === correctOrder.length) perfectCount++;
    });

    const positionAccuracy = positionCorrect.map((count, i) => ({
      position: i + 1,
      item: items[i],
      correct: count,
      total: totalVoters,
      pct: Math.round((count / totalVoters) * 100),
    }));

    const avgScore = Math.round((totalCorrectPositions / (totalVoters * items.length)) * 100);

    return { totalVoters, positionAccuracy, perfectCount, avgScore };
  }, [votes, items]);
  // 숫자는 순위(1위·2위…)에만 쓴다. 항목에 따로 번호를 붙이면 "④ → ③"처럼 정답이 틀려 보인다.
  const boardOrder = useMemo(() => boardRankingOrder(items, questionId), [items, questionId]);

  // 공개 전: 무엇을 정렬하는지만 보여준다. 저장 순서가 곧 정답이라 문항별로 고정해 섞고, 번호는 붙이지 않는다.
  if (!revealed) return <div className={`w-full ${presenter ? 'max-w-4xl' : 'max-w-xl'} mx-auto px-4 space-y-5`}>
    <ul className={`flex flex-wrap justify-center gap-3 ${presenter ? 'lg:gap-4' : ''}`}>
      {boardOrder.map((itemIndex, position) => (
        <motion.li key={itemIndex} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 25, delay: position * 0.05 }}
          className={`rounded-xl border border-slate-200 bg-white dark:border-slate-600/70 dark:bg-slate-800/60 ${presenter ? 'px-6 py-4 lg:px-7 lg:py-5 classroom-option-label' : 'px-4 py-3 text-base'} font-semibold leading-snug text-slate-900 dark:text-slate-100 [word-break:keep-all]`}>
          {items[itemIndex]}
        </motion.li>
      ))}
    </ul>
    <p className={`text-center ${presenter ? 'text-xl lg:text-2xl' : 'text-base'} text-slate-600 dark:text-slate-300`}>
      <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">{analysis.totalVoters}명</span> 제출 · 1위부터 순서대로 맞춰보세요
    </p>
  </div>;


  // 공개 후: 정답 순서 한 목록. 한 줄 = "N위 · 항목 · 막대 · 맞힌 수" — 막대를 줄 안에 넣어 빈 가로 공간과 세로 높이를 줄인다.
  // 폭은 내용에 맞춘 3xl(약 768px). 전자칠판처럼 큰 화면에서는 글자 크기(lg:)로 키운다.
  return (
    <div className={`w-full ${presenter ? 'max-w-3xl lg:max-w-4xl' : 'max-w-2xl'} mx-auto space-y-5 px-4 ${presenter ? 'ranking-chart-stage' : ''}`}>
      <p className={`text-center ${presenter ? 'text-xl lg:text-2xl' : 'text-sm'} text-slate-600 dark:text-slate-300`}>
        순서를 모두 맞힌 학생 <span className={`font-bold tabular-nums text-slate-900 dark:text-slate-100 ${presenter ? 'text-3xl lg:text-4xl' : 'text-lg'}`}>{analysis.perfectCount}명</span>
        <span className="text-slate-400"> / {analysis.totalVoters}명</span>
      </p>
      <ol className={presenter ? 'space-y-2.5 lg:space-y-3' : 'space-y-3'}>
        {analysis.positionAccuracy.map((pos, i) => (
          <motion.li key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, type: 'spring', stiffness: 300, damping: 25 }}
            className={`grid items-center gap-x-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 ${presenter ? 'grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_auto] px-5 py-3.5 lg:py-4' : 'grid-cols-[auto_minmax(0,1fr)_auto] px-5 py-4'}`}>
            <span className={`font-bold tabular-nums text-slate-900 dark:text-slate-100 ${presenter ? 'text-2xl lg:text-3xl' : 'text-base'}`}>{pos.position}위</span>
            <span className={`min-w-0 font-semibold text-slate-900 dark:text-slate-100 [word-break:keep-all] ${presenter ? 'text-2xl lg:text-3xl' : 'text-base'}`}>{pos.item}</span>
            <div className={`${presenter ? 'h-3 lg:h-3.5' : 'col-span-3 row-start-2 mt-3 h-2'} bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden`} role="progressbar" aria-valuenow={pos.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${pos.position}위를 맞힌 비율 ${pos.pct}%`}>
              <motion.div className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400"
                initial={{ width: 0 }} animate={{ width: `${pos.pct}%` }}
                transition={{ type: 'spring', stiffness: 200, damping: 20, delay: i * 0.05 + 0.1 }} />
            </div>
            <span className={`whitespace-nowrap tabular-nums text-slate-500 dark:text-slate-400 ${presenter ? 'text-lg lg:text-2xl' : 'text-sm col-start-3 row-start-1'}`}>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{pos.correct}명</span> 맞힘
            </span>
          </motion.li>
        ))}
      </ol>
    </div>
  );
});
