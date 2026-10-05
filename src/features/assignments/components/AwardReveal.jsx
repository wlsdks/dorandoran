import { memo, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { getAwardById, getJudgeById } from '@/lib/judging/judges';

const ConfettiBurst = lazy(() => import('@/components/ui/ConfettiBurst'));

/**
 * AwardReveal — 단일 수상자 reveal 애니메이션.
 * unrevealed: 봉투(카드 뒤집기 전)
 * revealed: 이름 + 점수 + 상 이름
 */
export default memo(function AwardReveal({ awardId, winner, revealed, presenter = false }) {
  const award = getAwardById(awardId);
  if (!award || !winner) return null;

  const isGrand = awardId === 'grand';
  const judge = award.judgeId ? getJudgeById(award.judgeId) : null;

  if (!revealed) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="flex flex-col items-center gap-4"
      >
        <div className={`${isGrand ? 'w-36 h-44' : 'w-28 h-36'} rounded-2xl bg-slate-800 dark:bg-slate-700 flex items-center justify-center`}>
          <span className={`${isGrand ? 'text-5xl' : 'text-4xl'} font-bold text-slate-600 dark:text-slate-500`}>?</span>
        </div>
        <p className="text-lg font-bold text-slate-300 dark:text-slate-400 tracking-tight">{award.name}</p>
        {judge && <p className="text-sm text-slate-500">{judge.name} 선정</p>}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ rotateY: 90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      data-presenter={presenter} data-grand={isGrand} className="award-reveal flex flex-col items-center gap-4 relative"
    >
      {isGrand && (
        <Suspense fallback={null}><ConfettiBurst /></Suspense>
      )}
      <motion.div
        initial={{ scale: 0.5 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22, delay: 0.1 }}
        className={`award-reveal-avatar ${isGrand ? 'w-24 h-24' : 'w-20 h-20'} rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center ring-4 ring-slate-200 dark:ring-slate-700`}
      >
        <span className={`${isGrand ? 'text-4xl' : 'text-3xl'} font-bold text-slate-900 dark:text-slate-100`}>
          {winner.name?.charAt(0).toUpperCase()}
        </span>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center space-y-2"
      >
        <p className={`award-reveal-name ${isGrand ? 'text-4xl md:text-5xl' : 'text-3xl md:text-4xl'} font-bold text-white tracking-tight`}>
          {winner.name}
        </p>
        <div className="flex items-center justify-center gap-3">
          <span className="award-reveal-label inline-flex items-center px-4 py-1.5 bg-white/10 rounded-full text-sm font-bold text-white/90">
            {award.name}
          </span>
          <span className="award-reveal-score text-white/60 text-lg tabular-nums font-medium">{winner.score}점</span>
        </div>
        {judge && <p className="award-reveal-judge text-base text-white/50">{judge.name} ({judge.role}) 선정</p>}
      </motion.div>
    </motion.div>
  );
});
