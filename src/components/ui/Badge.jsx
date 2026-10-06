const variants = {
  primary: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  error: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  neutral: 'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-300',
};

const sizes = {
  sm: 'px-2.5 py-0.5 text-xs',
  md: 'px-3.5 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base',
  xl: 'px-5 py-2.5 text-lg',
};

export default function Badge({ variant = 'primary', size = 'sm', children, className = '' }) {
  return (
    <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-medium ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
