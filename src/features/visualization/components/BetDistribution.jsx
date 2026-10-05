import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useVotes } from '@/hooks/useVotes';
import { Shield, Target, Flame } from 'lucide-react';

const BET_CONFIG = [
  { multiplier: 1, label: '1x 안전', Icon: Shield },
  { multiplier: 2, label: '2x 자신', Icon: Target },
  { multiplier: 3, label: '3x 올인', Icon: Flame },
];

export default memo(function BetDistribution({ sessionId, questionId, presenter = false }) {
  const { votes } = useVotes(sessionId, questionId);

  const distribution = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0 };
    let total = 0;
    Object.values(votes).forEach((vote) => {
      const bet = parseInt(vote.bet, 10) || 1;
      if (counts[bet] !== undefined) counts[bet]++;
      total++;
    });
    return { counts, total };
  }, [votes]);

  if (distribution.total === 0) return null;

  if (presenter) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
        aria-label="베팅 분포" className="flex flex-wrap items-center justify-center gap-3 mt-4 border-t border-slate-600/50 pt-4 text-lg text-slate-300">
        <span className="font-medium mr-1">선택한 배율</span>
        {BET_CONFIG.map(({ multiplier, label }) => (
          <span key={multiplier} className="whitespace-nowrap rounded-lg bg-slate-700/50 px-3 py-2 inline-flex items-center gap-3">
            <span>{label.split(' ')[0]}</span><strong className="text-slate-100 tabular-nums">{distribution.counts[multiplier]}명</strong>
            <span className="tabular-nums text-slate-400">{Math.round(distribution.counts[multiplier] / distribution.total * 100)}%</span>
          </span>
        ))}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 25 }}
      className="w-full max-w-xl mx-auto px-8 mt-6"
    >
      <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">베팅 분포</p>
      <div className="flex gap-3">
        {BET_CONFIG.map(({ multiplier, label, Icon }) => {
          const count = distribution.counts[multiplier];
          const pct = distribution.total > 0 ? Math.round((count / distribution.total) * 100) : 0;
          return (
            <motion.div
              key={multiplier}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.35 + multiplier * 0.06 }}
              className="flex-1 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-center"
            >
              <Icon size={16} className="text-slate-400 mx-auto mb-1.5" />
              <p className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">{count}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{label}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{pct}%</p>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
});
