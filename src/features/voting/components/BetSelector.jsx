import { memo } from 'react';
import { BET_OPTIONS } from '@/lib/quiz';

/** 선택지를 가리지 않는 선택형 배율. 기본1x이며 제출 전에는 언제든 수정할 수 있다. */
export default memo(function BetSelector({ value = 1, onSelect, disabled = false }) {
  const selected = BET_OPTIONS.find(option => option.multiplier === value) || BET_OPTIONS[0];
  return <fieldset className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 space-y-2" disabled={disabled}>
    <legend className="px-1 text-sm font-semibold text-slate-700 dark:text-slate-200">포인트 베팅 · 선택</legend>
    <div className="grid grid-cols-3 gap-2">
      {BET_OPTIONS.map(option => <button key={option.multiplier} type="button" aria-pressed={value === option.multiplier}
        onClick={() => onSelect(option.multiplier)} disabled={disabled}
        className={`min-h-12 rounded-lg px-2 text-sm font-semibold transition-colors active:scale-[0.98] ${value === option.multiplier ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200'}`}>
        {option.multiplier}x {option.label}
      </button>)}
    </div>
    <p role="status" className="text-sm text-slate-500 dark:text-slate-300">정답 {selected.multiplier}배 · {selected.penalty ? `오답 -${selected.penalty}점` : '오답 감점 없음'}</p>
  </fieldset>;
});
