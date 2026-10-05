import { motion } from 'framer-motion';
import DoranDoranMascot from './DoranDoranMascot';

/**
 * Friendly empty-state component for admin screens.
 * Shows the DoranDoran mascot, a title, description, and optional action steps.
 *
 * @param {string} title — main message
 * @param {string} description — sub-description
 * @param {string[]} steps — optional step-by-step guidance
 * @param {'xs' | 'sm' | 'md' | 'lg'} mascotSize
 * @param {'happy' | 'waiting' | 'thinking'} mood
 * @param {React.ReactNode} children — optional extra content below
 * @param {string} className — additional wrapper classes
 */
export default function EmptyState({
  title,
  description,
  steps,
  mascotSize = 'md',
  mood = 'waiting',
  children,
  className = '',
  titleAs: Title = 'p',
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className={`flex flex-col items-center text-center ${className}`}
    >
      <DoranDoranMascot size={mascotSize} mood={mood} />

      <div className="mt-6 space-y-2">
        <Title className="text-slate-800 dark:text-slate-200 text-xl font-bold tracking-tight">{title}</Title>
        {description && (
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-sm">{description}</p>
        )}
      </div>

      {steps && steps.length > 0 && (
        <div className="mt-6 space-y-2.5 w-full max-w-xs">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: 0.15 + i * 0.06 }}
              className="flex items-start gap-3 text-left"
            >
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{step}</span>
            </motion.div>
          ))}
        </div>
      )}

      {children && <div className="mt-5">{children}</div>}
    </motion.div>
  );
}
