import { Gift, Trophy } from 'lucide-react';
import { getQuizEventBadges, normalizeQuizEvent } from '@/lib/quiz';
const STATE_STYLES = {
  pending: {
    card: 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200',
    label: 'text-slate-400',
    icon: 'text-slate-400',
    title: '다음 퀴즈 이벤트'
  },
  active: {
    card: 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm',
    label: 'text-slate-900 dark:text-slate-100',
    icon: 'text-slate-900 dark:text-slate-100',
    title: '보너스 라운드'
  },
  result: {
    card: 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm',
    label: 'text-slate-500 dark:text-slate-400',
    icon: 'text-slate-500 dark:text-slate-400',
    title: '적용된 이벤트'
  }
};
const EVENT_ICONS = {
  'double-points': Trophy
};
export default function QuizEventBanner({
  event,
  state = 'active',
  compact = false,
  className = ''
}) {
  const normalized = normalizeQuizEvent(event);
  if (!normalized) return null;
  const style = STATE_STYLES[state] || STATE_STYLES.active;
  const Icon = EVENT_ICONS[normalized.id] || Gift;
  const badges = getQuizEventBadges(normalized);
  return <div className={`rounded-xl border px-4 py-3 ${style.card} ${className}`}>
      <div className={`flex items-start gap-3 ${compact ? 'items-center' : ''}`}>
        <Icon size={16} className={`shrink-0 mt-0.5 ${style.icon}`} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-xs font-medium ${style.label}`}>
              {style.title}
            </span>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{normalized.label}</span>
          </div>
          {!compact && <p className="max-w-[28rem] text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {normalized.description?.replace(/다음 퀴즈/g, state === 'active' || state === 'result' ? '이번 퀴즈' : '다음 퀴즈')}
            </p>}
          {/* Badges only shown for jackpot (multiple effects) */}
          {badges.length > 1 && <div className="flex flex-wrap gap-1.5">
              {badges.map(badge => <span key={badge} className="text-xs text-slate-400">
                  {badge}
                </span>)}
            </div>}
        </div>
      </div>
    </div>;
}
