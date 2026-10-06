import { useState } from 'react';
import { Timer } from 'lucide-react';
import { TIME_LIMIT_MAX, TIME_LIMIT_MIN, TIME_LIMIT_PRESETS, normalizeTimeLimit } from '@/lib/question-timer';

const CHIP = 'min-h-11 px-3.5 rounded-lg text-sm font-medium transition-colors duration-150 active:scale-[0.97]';
const ON = 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900';
const OFF = 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600';

/**
 * 문항별 시간 제한 — 활성화하면 이 길이로 타이머가 자동 시작하고 0초에 응답이 잠긴다.
 * value는 초(number) 또는 null(제한 없음).
 */
export default function TimeLimitSection({ value, onChange }) {
  const isPreset = value == null || TIME_LIMIT_PRESETS.includes(value);
  const [customOpen, setCustomOpen] = useState(!isPreset);
  const [draft, setDraft] = useState(isPreset ? '' : String(value));

  function pickCustom(text) {
    setDraft(text);
    onChange(normalizeTimeLimit(text));
  }

  return (
    <div className="pt-4">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Timer size={13} aria-hidden="true" />시간 제한 <span className="normal-case font-normal">(선택)</span>
      </p>
      <div role="radiogroup" aria-label="시간 제한" className="flex flex-wrap gap-2">
        <button type="button" role="radio" aria-checked={value == null && !customOpen}
          onClick={() => { setCustomOpen(false); onChange(null); }} className={`${CHIP} ${value == null && !customOpen ? ON : OFF}`}>없음</button>
        {TIME_LIMIT_PRESETS.map(seconds => (
          <button key={seconds} type="button" role="radio" aria-checked={value === seconds && !customOpen}
            onClick={() => { setCustomOpen(false); onChange(seconds); }} className={`${CHIP} tabular-nums ${value === seconds && !customOpen ? ON : OFF}`}>{seconds}초</button>
        ))}
        <button type="button" role="radio" aria-checked={customOpen}
          onClick={() => { setCustomOpen(true); onChange(normalizeTimeLimit(draft)); }} className={`${CHIP} ${customOpen ? ON : OFF}`}>직접 입력</button>
      </div>
      {customOpen && (
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="number" inputMode="numeric" min={TIME_LIMIT_MIN} max={TIME_LIMIT_MAX} value={draft}
            onChange={(e) => pickCustom(e.target.value)} aria-label="시간 제한(초)" placeholder="예: 45"
            className="w-28 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
          초
          {draft !== '' && normalizeTimeLimit(draft) == null && (
            <span role="alert" className="text-xs text-red-600 dark:text-red-400">{TIME_LIMIT_MIN}~{TIME_LIMIT_MAX}초 사이로 입력해주세요</span>
          )}
        </label>
      )}
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">문항을 시작하면 타이머가 자동으로 돌고, 0초가 되면 응답이 잠겨요. 진행 중에도 상단 타이머에서 멈추거나 늘릴 수 있어요.</p>
    </div>
  );
}
