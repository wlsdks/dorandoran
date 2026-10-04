import { motion as motionTokens } from '@/lib/design-tokens';
import { motion } from 'framer-motion';

const sizes = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

const variants = {
  ghost: 'hover:bg-slate-100 text-slate-500 hover:text-slate-700 dark:hover:bg-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
  subtle: 'bg-slate-50 hover:bg-slate-100 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300',
  primary: 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200',
  danger: 'hover:bg-slate-200 text-slate-400 hover:text-slate-700 dark:hover:bg-slate-700 dark:text-slate-500 dark:hover:text-slate-200',
};

export default function IconButton({
  icon: Icon,
  size = 'md',
  variant = 'ghost',
  label,
  className = '',
  ...props
}) {
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 24 : 20;

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      transition={motionTokens.spring.stiff}
      className={`inline-flex items-center justify-center rounded-lg transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-1 ${sizes[size]} ${variants[variant]} ${className}`}
      aria-label={label}
      {...props}
    >
      <Icon size={iconSize} />
    </motion.button>
  );
}
