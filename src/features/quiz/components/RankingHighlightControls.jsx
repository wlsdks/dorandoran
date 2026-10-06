import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, ListOrdered, RotateCcw, Settings2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import {
  clearHighlightSpotlight, normalizeHighlightPreset, parseHighlightRanks, presetRankingHighlight,
  restartHighlightPreset, revealNextHighlight, MAX_HIGHLIGHT_RANKS,
} from '@/lib/ranking-highlight';

const keepLocal = event => { if (event.key === ' ' || event.key === 'Enter') event.stopPropagation(); };

/**
 * Dialog for planning the special ranks before class. Saving replaces the plan
 * and rewinds progress, so nothing is shown until the next reveal.
 */
export function HighlightPresetDialog({ open, onClose, highlight, onSave, maxRank }) {
  const preset = normalizeHighlightPreset(highlight);
  const ranksText = preset?.ranks.join(', ') || '';
  const [input, setInput] = useState(ranksText);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { if (open) { setInput(ranksText); setError(''); } }, [open, ranksText]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function submit(event) {
    event.preventDefault();
    event.stopPropagation();
    const parsed = parseHighlightRanks(input, maxRank);
    if (parsed.error) { setError(parsed.error); return; }
    setSaving(true);
    try {
      await onSave(presetRankingHighlight(parsed.ranks));
      if (mounted.current) onClose();
    } catch {
      if (mounted.current) setError('특별 순위를 저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  return <Modal open={open} onClose={() => { if (!saving) onClose(); }} ariaLabel="특별 순위 설정">
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">특별 순위 설정</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">랭킹에서 차례로 공개할 순위를 미리 정해 두세요.</p>
      </div>
      <label className="block space-y-2"><span className="text-sm font-medium text-slate-700 dark:text-slate-200">특별 순위</span>
        <input value={input} onChange={event => { setInput(event.target.value); setError(''); }} autoFocus disabled={saving} inputMode="numeric" placeholder="예: 1, 2, 3, 27"
          className="min-h-12 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 text-base text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
      </label>
      <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">쉼표나 공백으로 구분해 최대 {MAX_HIGHLIGHT_RANKS}개까지, 적은 순서대로 공개됩니다.{preset?.revealed ? ' 저장하면 처음부터 다시 공개해요.' : ''}</p>
      {error && <p role="alert" className="text-sm text-red-500 dark:text-red-300">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={onClose} disabled={saving} className="flex-1">취소</Button>
        <Button type="submit" disabled={saving} className="flex-1">{saving ? '저장 중…' : '저장'}</Button>
      </div>
    </form>
  </Modal>;
}

/**
 * In-class controls: one primary action reveals the next planned rank. Only
 * rendered for authorized controllers; persistence remains with the caller.
 */
export default function RankingHighlightControls({ highlight, onHighlightChange, maxRank, size = 'sm' }) {
  const preset = normalizeHighlightPreset(highlight);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true), inFlight = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function publish(value) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError('');
    try {
      await onHighlightChange(value);
    } catch {
      if (mounted.current) setError('특별 순위를 저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  const total = preset?.ranks.length || 0;
  const revealed = preset?.revealed || 0;
  const done = total > 0 && revealed >= total;
  const iconButton = `inline-flex items-center justify-center gap-1.5 rounded-lg font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed ${size === 'lg' ? 'min-h-12 min-w-12 px-4 text-base' : 'min-h-11 min-w-11 px-3 text-sm'}`;

  return <>
    <div className="flex flex-wrap items-center gap-2" aria-label="특별 순위 조작">
      {preset ? <>
        <Button size={size} onKeyDown={keepLocal} disabled={saving || done} onClick={() => publish(revealNextHighlight(preset))}
          aria-label={`특별 순위 공개 (${revealed}/${total})`}>
          <Eye />특별 순위 공개<span className="tabular-nums opacity-70">{revealed}/{total}</span>
        </Button>
        {preset.enabled && <button type="button" className={iconButton} onKeyDown={keepLocal} disabled={saving} onClick={() => publish(clearHighlightSpotlight(preset))} aria-label="특별 순위 해제"><EyeOff size={16} />해제</button>}
        {revealed > 0 && <button type="button" className={iconButton} onKeyDown={keepLocal} disabled={saving} onClick={() => publish(restartHighlightPreset(preset))} aria-label="특별 순위 처음부터"><RotateCcw size={16} />처음부터</button>}
        <button type="button" className={iconButton} onKeyDown={keepLocal} disabled={saving} onClick={() => setOpen(true)} aria-label="특별 순위 설정" title={`특별 순위: ${preset.ranks.join(', ')}위`}><Settings2 size={16} /><span className="sr-only">설정</span></button>
      </> : <Button size={size} variant="secondary" onKeyDown={keepLocal} disabled={saving || maxRank < 1} onClick={() => setOpen(true)} aria-label="특별 순위 설정"><ListOrdered />특별 순위 설정</Button>}
    </div>
    {error && <p role="alert" className="text-sm text-red-500 dark:text-red-300">{error}</p>}
    <HighlightPresetDialog open={open} onClose={() => setOpen(false)} highlight={highlight} onSave={onHighlightChange} maxRank={maxRank} />
  </>;
}
