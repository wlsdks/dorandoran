import { memo, lazy, Suspense } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { spring } from '@/lib/motion';
import { getAwardById, getJudgeById } from '@/lib/judging/judges';

const ConfettiBurst = lazy(() => import('@/components/ui/ConfettiBurst'));

/**
 * AwardReveal — 단일 수상자 reveal 애니메이션.
 * unrevealed: 봉투(카드 뒤집기 전)
 * revealed: 이름 + 점수 + 상 이름
 */
export default memo(function AwardReveal({ awardId, winner, revealed, presenter = false, showJudge = false }) {
  const reduced = useReducedMotion();
  const award = getAwardById(awardId);
  if (!award || !winner) return null;

  const isGrand = awardId === 'grand';
  const judge = showJudge && award.judgeId ? getJudgeById(award.judgeId) : null;

  if (!revealed) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: reduced ? 1 : 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={spring.default}
        className="flex flex-col items-center gap-4"
      >
        <div className={`${isGrand ? 'w-36 h-44' : 'w-28 h-36'} rounded-2xl bg-slate-800 dark:bg-slate-700 flex items-center justify-center`}>
          <span className={`${isGrand ? 'text-5xl' : 'text-4xl'} font-bold text-slate-600 dark:text-slate-500`}>?</span>
        </div>
        <p className="text-lg font-bold text-slate-700 dark:text-slate-300 tracking-tight">{award.name}</p>
        {judge && <p className="text-sm text-slate-500">{judge.name} 선정</p>}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ rotateY: reduced ? 0 : 90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={reduced ? { duration: 0.12 } : spring.default}
      data-presenter={presenter} data-grand={isGrand} className="award-reveal flex flex-col items-center gap-4 relative"
    >
      {isGrand && !reduced && (
        <Suspense fallback={null}><ConfettiBurst /></Suspense>
      )}
      <motion.div
        initial={{ scale: reduced ? 1 : 0.5 }}
        animate={{ scale: 1 }}
        transition={{ ...spring.bouncy, delay: 0.1 }}
        className={`award-reveal-avatar ${isGrand ? 'w-24 h-24' : 'w-20 h-20'} rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center ring-4 ring-slate-200 dark:ring-slate-700`}
      >
        <span className={`${isGrand ? 'text-4xl' : 'text-3xl'} font-bold text-slate-900 dark:text-slate-100`}>
          {winner.name?.charAt(0).toUpperCase()}
        </span>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: reduced ? 0 : 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="award-reveal-details text-center space-y-2"
      >
        <p className={`award-reveal-name ${isGrand ? 'text-4xl md:text-5xl' : 'text-3xl md:text-4xl'} font-bold text-slate-900 dark:text-white tracking-tight`}>
          {winner.name}
        </p>
        <div className="flex items-center justify-center gap-3">
          <span className="award-reveal-label inline-flex items-center px-4 py-1.5 bg-slate-100 dark:bg-white/10 rounded-full text-sm font-bold text-slate-900 dark:text-white/90">
            {award.name}
          </span>
          <span className="award-reveal-score text-slate-600 dark:text-white/60 text-lg tabular-nums font-medium">{winner.score}점</span>
        </div>
        {judge && <p className="award-reveal-judge text-base text-slate-600 dark:text-white/50">{judge.name} ({judge.role}) 선정</p>}
      </motion.div>
    </motion.div>
  );
});
