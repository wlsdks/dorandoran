import { useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { useVotes } from '@/hooks/useVotes';

/**
 * Histogram buckets for distribution display.
 * 10 buckets: 0-9, 10-19, ..., 90-100
 */
const BUCKET_COUNT = 10;

function bucketize(voteList) {
  const buckets = new Array(BUCKET_COUNT).fill(0);
  voteList.forEach((v) => {
    const num = parseInt(v.value, 10);
    if (isNaN(num)) return;
    const idx = Math.min(Math.floor(num / 10), BUCKET_COUNT - 1);
    buckets[idx]++;
  });
  return buckets;
}

function computeStats(voteList) {
  const values = voteList
    .map((v) => parseInt(v.value, 10))
    .filter((n) => !isNaN(n) && n >= 0 && n <= 100);

  if (values.length === 0) {
    return { avg: 0, median: 0, min: 0, max: 0, count: 0 };
  }

  values.sort((a, b) => a - b);
  const sum = values.reduce((s, v) => s + v, 0);
  const avg = Math.round(sum / values.length);
  const mid = Math.floor(values.length / 2);
  const median = values.length % 2 === 0
    ? Math.round((values[mid - 1] + values[mid]) / 2)
    : values[mid];

  return {
    avg,
    median,
    min: values[0],
    max: values[values.length - 1],
    count: values.length,
  };
}

/** Map 0-100 to color intensity. */
function getBarColor(bucketIndex) {
  const intensity = Math.round((bucketIndex / (BUCKET_COUNT - 1)) * 4);
  const shades = [
    'bg-slate-200 dark:bg-slate-700',
    'bg-slate-300 dark:bg-slate-600',
    'bg-slate-400 dark:bg-slate-500',
    'bg-slate-600 dark:bg-slate-400',
    'bg-slate-800 dark:bg-slate-200',
  ];
  return shades[intensity] || 'bg-slate-400 dark:bg-slate-500';
}

export default memo(function ScaleChart({ sessionId, questionId, minLabel = '낮음', maxLabel = '높음' }) {
  const { voteList, totalVotes } = useVotes(sessionId, questionId);

  const buckets = useMemo(() => bucketize(voteList), [voteList]);
  const stats = useMemo(() => computeStats(voteList), [voteList]);
  const maxBucket = useMemo(() => Math.max(...buckets, 1), [buckets]);

  return (
    <div className="space-y-7 w-full max-w-xl mx-auto px-8">
      {/* Average hero display */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="text-center"
      >
        <motion.p
          key={stats.avg}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          className="text-7xl font-bold text-slate-900 dark:text-slate-100 tabular-nums leading-none"
        >
          {stats.count > 0 ? stats.avg : '--'}
        </motion.p>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">평균 · 100점 만점</p>
      </motion.div>

      {/* 감정 온도계 게이지 — 아쉬움 → 최고, 평균 위치를 포인터로 명확히 */}
      {stats.count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {/* 평균 포인터 (트랙 위) */}
          <div className="relative h-7">
            <motion.div
              className="absolute flex flex-col items-center -translate-x-1/2"
              initial={{ left: '0%', opacity: 0 }}
              animate={{ left: `${stats.avg}%`, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums mb-0.5 whitespace-nowrap">평균 {stats.avg}</span>
              <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-slate-900 dark:border-t-slate-100" />
            </motion.div>
          </div>
          {/* 그라데이션 트랙 (낮음→높음) */}
          <div className="relative h-5 rounded-full bg-gradient-to-r from-slate-200 via-slate-400 to-slate-700 dark:from-slate-700 dark:via-slate-500 dark:to-slate-200">
            {/* 중앙값 마커 */}
            {stats.count >= 3 && (
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 w-1 h-7 rounded-full bg-white/90 dark:bg-slate-900/70 ring-1 ring-black/10"
                style={{ left: `${stats.median}%` }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                title={`중앙값: ${stats.median}`}
              />
            )}
          </div>
          {/* 양끝 라벨 — 실제 척도 의미(아쉬움/최고)를 크게 */}
          <div className="flex justify-between mt-2.5">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{minLabel}</span>
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{maxLabel}</span>
          </div>
        </motion.div>
      )}

      {/* Distribution histogram */}
      {stats.count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="space-y-2"
        >
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 tracking-wider uppercase">응답 분포</p>
          <div className="scale-histogram flex items-end gap-1.5 h-24">
            {buckets.map((count, i) => {
              const heightPct = maxBucket > 0 ? (count / maxBucket) * 100 : 0;
              return (
                <motion.div
                  key={i}
                  className="flex-1 h-full flex flex-col items-center justify-end gap-1"
                >
                  {count > 0 && (
                    <motion.span
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums"
                    >
                      {count}
                    </motion.span>
                  )}
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(heightPct * 0.75, count > 0 ? 8 : 2)}%` }}
                    transition={{ type: 'spring', stiffness: 200, damping: 20, delay: i * 0.05 }}
                    className={`w-full rounded-t-md ${count > 0 ? getBarColor(i) : 'bg-slate-100 dark:bg-slate-800'}`}
                    style={{ minHeight: count > 0 ? '4px' : '2px' }}
                  />
                </motion.div>
              );
            })}
          </div>
          {/* 분포 축 라벨 — 왼쪽=낮은 점수, 오른쪽=높은 점수 (숫자 버킷보다 직관적) */}
          <div className="flex justify-between pt-1 border-t border-slate-100 dark:border-slate-700/60">
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">{minLabel}</span>
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">{maxLabel}</span>
          </div>
        </motion.div>
      )}

      {/* Stats summary */}
      {stats.count >= 3 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="flex justify-center gap-6"
        >
          <div className="text-center">
            <p className="text-lg font-bold tracking-tight text-slate-700 dark:text-slate-200 tabular-nums">{stats.median}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">중앙값</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold tracking-tight text-slate-700 dark:text-slate-200 tabular-nums">{stats.min}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">최솟값</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold tracking-tight text-slate-700 dark:text-slate-200 tabular-nums">{stats.max}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">최댓값</p>
          </div>
        </motion.div>
      )}

      {/* Total count */}
      <div className="text-center text-slate-400 text-sm pt-2 border-t border-slate-100 dark:border-slate-700">
        총 <span className="text-slate-600 dark:text-slate-300 font-semibold">{totalVotes}</span>명 응답
      </div>
    </div>
  );
});
