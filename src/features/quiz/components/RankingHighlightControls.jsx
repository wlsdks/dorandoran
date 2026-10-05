import { useEffect, useRef, useState } from 'react';
import { Target, ArrowRight, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { nextRankingHighlight, normalizeRankingHighlight, parseHighlightRanks } from '@/lib/ranking-highlight';

/** Only rendered for authorized controllers; persistence remains with the caller. */
export default function RankingHighlightControls({ highlight, onHighlightChange, maxRank }) {
  const config = normalizeRankingHighlight(highlight);
  const ranksText = config?.ranks.join(', ') || '';
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(ranksText);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true), inFlight = useRef(false);
  useEffect(() => { setInput(ranksText); }, [ranksText]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function publish(value) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError('');
    try {
      await onHighlightChange(value);
      if (mounted.current) setOpen(false);
    } catch {
      if (mounted.current) setError('강조 순위를 저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  function apply(event) {
    event.preventDefault();
    event.stopPropagation();
    const parsed = parseHighlightRanks(input, maxRank);
    if (parsed.error) { setError(parsed.error); return; }
    publish({ ranks: parsed.ranks, activeRank: parsed.ranks[0], enabled: true });
  }

  const button = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm font-medium text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40';
  const keepLocal = event => { if (event.key === ' ' || event.key === 'Enter') event.stopPropagation(); };
  return <>
    <div className="flex items-center gap-2" aria-label="강조 순위 조작">
      <button type="button" className={button} onKeyDown={keepLocal} onClick={() => { setError(''); setOpen(true); }} disabled={saving || maxRank < 1} aria-label="강조 순위 설정"><Target size={16} />강조 순위</button>
      {config && <>
        <button type="button" className={button} onKeyDown={keepLocal} disabled={saving || config.ranks.length < 2} onClick={() => publish(nextRankingHighlight(config))}><ArrowRight size={16} />다음 강조</button>
        <button type="button" className={button} onKeyDown={keepLocal} disabled={saving} onClick={() => publish(null)} aria-label="강조 해제"><X size={16} />강조 해제</button>
      </>}
    </div>
    {!open && error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    <Modal open={open} onClose={() => { if (!saving) setOpen(false); }} ariaLabel="강조 순위 설정">
      <form onSubmit={apply} className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">강조 순위</h2>
        <label className="block space-y-2"><span className="text-sm font-medium text-slate-700 dark:text-slate-200">강조할 순위</span>
          <input value={input} onChange={event => { setInput(event.target.value); setError(''); }} autoFocus disabled={saving} placeholder="예: 1, 3, 10" className="min-h-12 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 text-base text-slate-900 dark:text-slate-100" />
        </label>
        <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">현재 표시된 순위 번호를 쉼표나 공백으로 구분하세요. 최대 10개까지 입력한 순서대로 강조합니다.</p>
        {error && <p role="alert" className="text-sm text-red-500 dark:text-red-300">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={() => setOpen(false)} disabled={saving} className="min-h-12 flex-1 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200">취소</button>
          <button type="submit" disabled={saving} className="min-h-12 flex-1 rounded-xl bg-indigo-600 text-white font-semibold disabled:opacity-50">{saving ? '저장 중…' : '강조하기'}</button>
        </div>
      </form>
    </Modal>
  </>;
}
