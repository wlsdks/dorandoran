import { memo, useState } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useRealtimeValue } from '@/hooks/useRealtimeValue';
import { normalizeHighlightPreset, rankingHighlightUpdates } from '@/lib/ranking-highlight';
import { HighlightPresetDialog } from '@/features/quiz/components/RankingHighlightControls';

/** 수업 전에 정해 두는 특별 순위. 랭킹 모드에서 '특별 순위 공개' 버튼이 이 순서대로 공개한다. */
export default memo(function SpecialRankPreset({ sessionId }) {
  const { value } = useRealtimeValue(sessionId ? `sessions/${sessionId}/leaderboardHighlight` : null);
  const preset = normalizeHighlightPreset(value);
  const [open, setOpen] = useState(false);
  const save = config => update(ref(db, `sessions/${sessionId}`), rankingHighlightUpdates(config));
  return <div className="flex min-h-11 items-center justify-between gap-3 px-1 text-sm text-slate-700 dark:text-slate-200">
    <span className="min-w-0">
      특별 순위
      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
        {preset ? `${preset.ranks.map(rank => `${rank}위`).join(' · ')}${preset.revealed ? ` · ${preset.revealed}/${preset.ranks.length} 공개됨` : ''}` : '랭킹에서 차례로 공개할 순위'}
      </span>
    </span>
    <button type="button" onClick={() => setOpen(true)} aria-label="특별 순위 설정"
      className="min-h-11 shrink-0 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">
      {preset ? '변경' : '설정'}
    </button>
    <HighlightPresetDialog open={open} onClose={() => setOpen(false)} highlight={value} onSave={save} maxRank={Infinity} />
  </div>;
});
