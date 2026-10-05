import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useVotes } from '@/hooks/useVotes';
import { Check, X } from 'lucide-react';

/**
 * RankingChart — instructor visualization for ranking questions.
 *
 * Shows:
 * - Each item with its correct position and how many students placed it correctly
 * - Overall accuracy percentage hero number
 * - Per-position accuracy bars
 */
export default memo(function RankingChart({ sessionId, questionId, items = [], revealed = true, presenter = false }) {
  const { votes } = useVotes(sessionId, questionId);

  const analysis = useMemo(() => {
    const voteEntries = Object.values(votes || {});
    const totalVoters = voteEntries.length;
    if (totalVoters === 0 || items.length === 0) {
      return { totalVoters: 0, positionAccuracy: [], perfectCount: 0, avgScore: 0 };
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

  if (!revealed) return <div className="text-center py-8 space-y-4">
    <p className="text-5xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{analysis.totalVoters}명</p>
    <p className="text-xl text-slate-500 dark:text-slate-300">순서를 맞춰 제출해주세요</p>
    <p className="text-base text-slate-500 dark:text-slate-300">정답 순서는 잠시 후 함께 공개합니다</p>
  </div>;

  if (analysis.totalVoters === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-400 dark:text-slate-500 text-sm">아직 응답이 없습니다</p>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-xl mx-auto space-y-6 px-4 ${presenter ? 'ranking-chart-stage' : ''}`}>
      {/* Hero stats */}
      <div className="text-center space-y-1">
        <motion.p
          key={analysis.avgScore}
          initial={{ scale: 1.1, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          className="text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums"
        >
          {analysis.avgScore}%
        </motion.p>
        <p className="text-sm text-slate-400">평균 정확도</p>
        <div className="flex items-center justify-center gap-4 mt-2">
          <span className="text-xs text-slate-500">
            <span className="font-semibold text-slate-700 dark:text-slate-200">{analysis.totalVoters}</span>명 응답
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-200">{analysis.perfectCount}</span>명 전부 정답
          </span>
        </div>
      </div>

      {/* Per-position accuracy */}
      <div className="space-y-2">
        {analysis.positionAccuracy.map((pos, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, type: 'spring', stiffness: 300, damping: 25 }}
            className="flex items-center gap-3"
          >
            {/* Position number */}
            <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500 dark:text-slate-300 shrink-0">
              {pos.position}
            </span>

            {/* Item name + bar */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{pos.item}</span>
                <span className="text-xs tabular-nums text-slate-400 shrink-0 ml-2">
                  {pos.correct}/{pos.total}
                </span>
              </div>
              <div className="h-6 bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden relative">
                <motion.div
                  className={`h-full rounded-lg ${
                    pos.pct >= 70
                      ? 'bg-slate-700 dark:bg-slate-300'
                      : pos.pct >= 40
                        ? 'bg-slate-400 dark:bg-slate-500'
                        : 'bg-slate-200 dark:bg-slate-600'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(pos.pct, 2)}%` }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20, delay: i * 0.05 + 0.1 }}
                />
                {/* Percentage label inside bar */}
                <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold tabular-nums ${
                  pos.pct >= 50 ? 'text-white' : 'text-slate-500'
                }`}>
                  {pos.pct}%
                </span>
              </div>
            </div>

            {/* Correct/incorrect indicator */}
            <div className="shrink-0">
              {pos.pct >= 70 ? (
                <Check size={16} className="text-slate-600" />
              ) : pos.pct < 30 ? (
                <X size={16} className="text-slate-300" />
              ) : null}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Correct order reference */}
      {!presenter && <div className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-4 py-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">정답 순서</p>
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs text-slate-600 dark:text-slate-300">
              <span className="font-bold text-slate-500 dark:text-slate-400">{i + 1}.</span> {item}
            </span>
          ))}
        </div>
      </div>}
    </div>
  );
});
