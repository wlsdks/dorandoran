import { useState } from 'react';
import Button from '@/components/ui/Button';
import { BREAK_LABELS, BREAK_PRESET_MINUTES, clampBreakMinutes } from '@/lib/break-time';

const STYLE_OPTIONS = [
  { value: 'countdown', label: '남은 시간', hint: '10:00부터 줄어들어요' },
  { value: 'startAt', label: '시작 시각', hint: '"21:40 시작"으로 보여요' },
];

function Segmented({ label, options, value, onChange, disabled }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-flow-col auto-cols-fr gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
      {options.map(option => (
        <button key={option.value} type="button" role="radio" aria-checked={value === option.value} disabled={disabled}
          onClick={() => onChange(option.value)}
          className={`min-h-11 rounded-lg px-3 text-sm font-semibold transition-colors duration-150 disabled:opacity-50 ${value === option.value
            ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white'
            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'}`}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** 강사용 쉬는 시간 설정 — 표시 이름, 표시 방식, 분을 고르고 시작한다. */
export default function BreakControls({ label, style, running, onLabel, onStart, onStop }) {
  const [kind, setKind] = useState(style);
  const [minutes, setMinutes] = useState(10);
  const [custom, setCustom] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(action) {
    setBusy(true); setError('');
    try { await action(); } catch { setError('저장하지 못했어요. 연결 상태를 확인하고 다시 시도해주세요.'); }
    finally { setBusy(false); }
  }

  const chosen = custom !== '' ? clampBreakMinutes(custom) : minutes;

  return (
    <div className="w-full max-w-md space-y-3" onClick={e => e.stopPropagation()}>
      <Segmented label="표시 이름" value={label} disabled={busy}
        options={BREAK_LABELS.map(value => ({ value, label: value }))}
        onChange={value => run(() => onLabel(value))} />
      {running ? (
        <Button onClick={() => run(onStop)} variant="secondary" size="md" className="w-full min-h-12" disabled={busy}>타이머 끄기</Button>
      ) : (
        <>
          <Segmented label="표시 방식" value={kind} options={STYLE_OPTIONS} onChange={setKind} disabled={busy} />
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">{STYLE_OPTIONS.find(o => o.value === kind)?.hint}</p>
          <div className="flex items-center gap-2">
            {BREAK_PRESET_MINUTES.map(value => (
              <button key={value} type="button" onClick={() => { setMinutes(value); setCustom(''); }} aria-pressed={custom === '' && minutes === value}
                className={`min-h-11 flex-1 rounded-lg border text-sm font-semibold transition-colors duration-150 ${custom === '' && minutes === value
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'}`}>
                {value}분
              </button>
            ))}
            <label className="flex min-h-11 flex-1 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 focus-within:ring-2 focus-within:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800">
              <input value={custom} onChange={e => setCustom(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))} inputMode="numeric"
                placeholder="직접" aria-label="직접 입력(분)"
                className="w-full min-w-0 bg-transparent text-center text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none dark:text-slate-100" />
              <span className="text-xs text-slate-500">분</span>
            </label>
          </div>
          <Button onClick={() => chosen && run(() => onStart(chosen, kind))} variant="primary" size="md" className="w-full min-h-12" disabled={busy || !chosen}>
            {chosen ? (kind === 'startAt' ? `${chosen}분 뒤 시작으로 표시` : `${chosen}분 타이머 시작`) : '1~180분을 입력하세요'}
          </Button>
        </>
      )}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>}
    </div>
  );
}
