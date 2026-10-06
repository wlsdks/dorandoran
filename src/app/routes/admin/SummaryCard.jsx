import { motion } from 'framer-motion';
import { list, spring } from '@/lib/motion';

export default function SummaryCard({ label, value, subtitle, progress }) {
  return (
    <motion.div variants={list.item} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 max-sm:p-4">
      <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider mb-3">{label}</p>
      <p className="text-3xl max-sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">{value}</p>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          {/* 너비 대신 scaleX — 레이아웃을 건드리지 않고 합성만 한다 */}
          <motion.div className="h-full w-full bg-slate-700 dark:bg-slate-300 rounded-full" style={{ originX: 0 }}
            initial={{ scaleX: 0 }} animate={{ scaleX: Math.min(1, Math.max(0, progress / 100)) }}
            transition={{ ...spring.gentle, delay: 0.3 }} />
        </div>
      )}
      {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{subtitle}</p>}
    </motion.div>
  );
}
