import AnimatedNumber from '@/components/ui/AnimatedNumber';
import { memo } from 'react';
import { motion } from 'framer-motion';

export default memo(function LiveParticipation({ voted, total }) {
  const pct = total > 0 ? Math.min(100, Math.round((voted / total) * 100)) : 0;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider">참여</span>
        <div className="flex items-baseline gap-2">
          <span className="text-slate-100 tabular-nums">
            <AnimatedNumber value={voted} className="text-2xl font-bold tracking-tight" />
            <span className="text-sm text-slate-500 ml-0.5">/ {total}명</span>
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-100 tabular-nums">
            <AnimatedNumber value={pct} className="" />%
          </span>
        </div>
      </div>
      <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full w-full origin-left bg-indigo-500 rounded-full"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: pct / 100 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        />
      </div>
    </div>
  );
});
