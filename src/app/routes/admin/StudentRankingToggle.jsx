import { memo } from 'react';
import { ref, set } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useRealtimeValue } from '@/hooks/useRealtimeValue';

/** 학생 폰의 '실시간 랭킹' 공개 여부. 기본은 공개, 끄면 학생 화면 랭킹 탭에 안내만 보인다. */
export default memo(function StudentRankingToggle({ sessionId }) {
  const { value: hidden } = useRealtimeValue(sessionId ? `sessions/${sessionId}/studentRankingHidden` : null);
  const visible = hidden !== true;
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-1 text-sm text-slate-700 dark:text-slate-200">
      <span>
        학생 랭킹 공개
        <span className="block text-xs text-slate-500 dark:text-slate-400">학생 화면에서 전체 순위를 볼 수 있어요</span>
      </span>
      <button type="button" role="switch" aria-checked={visible} aria-label="학생 랭킹 공개"
        onClick={() => set(ref(db, `sessions/${sessionId}/studentRankingHidden`), visible ? true : null)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${visible ? 'bg-slate-900 dark:bg-slate-100' : 'bg-slate-300 dark:bg-slate-600'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white dark:bg-slate-900 shadow transition-transform ${visible ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </button>
    </label>
  );
});
