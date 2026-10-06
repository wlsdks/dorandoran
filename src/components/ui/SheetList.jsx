import { motion, useReducedMotion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

/** iOS 설정 앱식 묶음 목록 — 시트 안에서 행 사이를 얇은 선으로 나눈다. */
export function SheetList({ label, showLabel = false, children, className = '' }) {
  return (
    <section className={className} aria-label={label}>
      {label && showLabel && <p className="mb-1.5 px-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>}
      <div className="overflow-hidden rounded-2xl bg-slate-50 dark:bg-slate-700/40 divide-y divide-slate-200/70 dark:divide-slate-600/50">{children}</div>
    </section>
  );
}

/**
 * 묶음 목록 한 행 — 아이콘, 제목, 짧은 설명, 오른쪽 값·화살표. 누르는 즉시 배경이 눌리고 살짝 작아진다.
 * 최소 56px 높이로 엄지로 잡기 쉽다. badge는 "새 메시지"처럼 짧은 상태 글자.
 */
export function SheetRow({ icon: Icon, title, subtitle, value, badge, onClick, chevron = true, disabled = false, ariaLabel, ...rest }) {
  const reduced = useReducedMotion();
  return (
    <motion.button type="button" onClick={onClick} disabled={disabled} aria-label={ariaLabel}
      whileTap={{ scale: reduced || disabled ? 1 : 0.985 }} transition={{ duration: 0.08 }}
      className="w-full min-h-14 flex items-center gap-3.5 px-4 py-3 text-left bg-transparent active:bg-slate-200/70 dark:active:bg-slate-600/60 hover:bg-slate-100/70 dark:hover:bg-slate-700/60 transition-colors duration-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500" {...rest}>
      {Icon && <Icon size={22} strokeWidth={1.9} aria-hidden="true" className="shrink-0 text-slate-600 dark:text-slate-300" />}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">{title}</span>
          {badge && <span className="shrink-0 text-xs font-semibold text-indigo-600 dark:text-indigo-300">{badge}</span>}
        </span>
        {subtitle && <span className="mt-0.5 block truncate text-sm text-slate-500 dark:text-slate-400">{subtitle}</span>}
      </span>
      {value && <span className="shrink-0 text-sm text-slate-500 dark:text-slate-400 tabular-nums">{value}</span>}
      {chevron && <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-slate-400 dark:text-slate-500" />}
    </motion.button>
  );
}
