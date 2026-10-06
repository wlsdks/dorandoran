const sizes = {
  sm: 'h-6 min-w-6 px-1 text-xs',
  md: 'h-8 min-w-8 px-1.5 text-sm',
  lg: 'h-10 min-w-10 px-2 text-base',
  xl: 'h-12 min-w-12 px-2 text-lg',
  stage: 'number-badge-stage',
};

const tones = {
  // 고정 번호 이름표 — 색이 아니라 명암으로 서는 짙은 원형(다크 CTA와 같은 톤).
  solid: 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900',
  outline: 'bg-white text-slate-700 ring-1 ring-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600',
  muted: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300',
};

/**
 * 번호 이름표 — 순위 맞추기 항목처럼 "몇 번"이 정체성인 곳에 쓰는 원형 숫자.
 * 숫자만 넣고(1부터), 글 맥락에서는 aria-label로 "1번 항목"처럼 읽힌다. 옆 글이 이미 번호를 말하면 label={null}로 꾸밈 처리.
 */
export default function NumberBadge({ number, size = 'md', tone = 'solid', label, className = '' }) {
  return (
    <span aria-label={label === null ? undefined : label || `${number}번`} aria-hidden={label === null || undefined} className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold tabular-nums leading-none ${sizes[size]} ${tones[tone]} ${className}`}>
      <span aria-hidden="true">{number}</span>
    </span>
  );
}
