import { motion } from 'framer-motion';
import DoranDoranMascot from './DoranDoranMascot';
import { fadeUp, list, spring } from '@/lib/motion';


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
      initial={fadeUp.initial}
      animate={fadeUp.animate}
      transition={spring.gentle}
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
        <motion.div variants={{ initial: {}, animate: { transition: { staggerChildren: 0.04, delayChildren: 0.12 } } }} initial="initial" animate="animate" className="mt-6 space-y-2.5 w-full max-w-xs">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              variants={list.item}
              className="flex items-start gap-3 text-left"
            >
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{step}</span>
            </motion.div>
          ))}
        </motion.div>
      )}

      {children && <div className="mt-5">{children}</div>}
    </motion.div>
  );
}
