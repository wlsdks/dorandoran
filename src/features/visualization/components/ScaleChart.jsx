import { useMemo, memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { grow } from '@/lib/motion';
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
    if (!Number.isFinite(num) || num < 0 || num > 100) return;
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
  const reduced = useReducedMotion();

  const buckets = useMemo(() => bucketize(voteList), [voteList]);
  const stats = useMemo(() => computeStats(voteList), [voteList]);
  const maxBucket = useMemo(() => Math.max(...buckets, 1), [buckets]);

  return (
    <section className="scale-result w-full max-w-xl mx-auto px-4" aria-label="척도 응답 결과">
      <div className="text-center">
        <p className="scale-result-average font-bold text-slate-900 dark:text-slate-100 tabular-nums leading-none">
          {stats.count > 0 ? stats.avg : '--'}
        </p>
        <p className="scale-result-caption text-slate-500 dark:text-slate-300 mt-2">평균 · 100점 만점</p>
      </div>

      {stats.count > 0 && <>
        <div>
          <div className="relative h-4 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"
            role="img" aria-label={`평균 ${stats.avg}점, ${minLabel}에서 ${maxLabel} 사이`}>
            <motion.div className="h-full w-full bg-indigo-500 dark:bg-indigo-400 origin-left"
              initial={{ scaleX: reduced ? stats.avg / 100 : 0 }} animate={{ scaleX: stats.avg / 100 }}
              transition={reduced ? { duration: 0 } : grow} />
          </div>
          <div className="scale-result-caption flex justify-between gap-4 mt-2 text-slate-600 dark:text-slate-300 font-medium">
            <span>{minLabel}</span><span className="text-right">{maxLabel}</span>
          </div>
        </div>

        <div className="space-y-2">
          <p className="scale-result-caption font-medium text-slate-600 dark:text-slate-300">응답 분포</p>
          <div className="scale-result-histogram flex items-end gap-1.5" role="img"
            aria-label={buckets.map((count, i) => `${i * 10}~${i === BUCKET_COUNT - 1 ? 100 : i * 10 + 9}점 ${count}명`).join(', ')}>
            {buckets.map((count, i) => (
              <div key={i} className="flex-1 h-full min-w-0 flex flex-col gap-1">
                <span className="scale-result-caption text-center font-semibold text-slate-500 dark:text-slate-300 tabular-nums" aria-hidden="true">
                  {count > 0 ? count : '\u00a0'}
                </span>
                <div className="flex-1 min-h-0">
                  <motion.div className={`h-full w-full rounded-t-md origin-bottom ${count > 0 ? getBarColor(i) : 'bg-slate-200 dark:bg-slate-700'}`}
                    initial={{ scaleY: reduced ? Math.max(count / maxBucket, 0.02) : 0 }}
                    animate={{ scaleY: Math.max(count / maxBucket, 0.02) }}
                    transition={reduced ? { duration: 0 } : grow} />
                </div>
              </div>
            ))}
          </div>
          <div className="scale-result-caption flex justify-between text-slate-500 dark:text-slate-300 border-t border-slate-200 dark:border-slate-700 pt-2" aria-hidden="true">
            <span>0점</span><span>100점</span>
          </div>
        </div>
      </>}

      <p className="scale-result-caption text-center text-slate-500 dark:text-slate-300 tabular-nums">
        {stats.count >= 3 && <>중앙값 <strong className="text-slate-700 dark:text-slate-100">{stats.median}</strong> · 범위 {stats.min}–{stats.max}점 · </>}
        총 <strong className="text-slate-700 dark:text-slate-100">{totalVotes}</strong>명 응답
      </p>
    </section>
  );
});
