import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { EyeOff } from 'lucide-react';
import { useScores } from '@/features/quiz/api/useScores';
import { getParticipantId } from '@/lib/participant';
import { buildStudentRanking, myRankingSummary } from '@/lib/student-ranking';

function RankRow({ entry, mine, rowRef }) {
  const podium = entry.rank <= 3;
  return (
    <li ref={rowRef} aria-current={mine ? 'true' : undefined}
      className={`grid grid-cols-[2.25rem_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl px-3 py-2.5 ${mine ? 'bg-indigo-500/10 ring-1 ring-indigo-400/60' : ''}`}>
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold tabular-nums ${podium ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 dark:text-slate-400'}`}>{entry.rank}</span>
      <span className={`min-w-0 truncate text-[15px] ${mine || podium ? 'font-semibold text-slate-900 dark:text-slate-100' : 'font-medium text-slate-700 dark:text-slate-200'}`}>
        {entry.nickname}{mine && <span className="ml-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-300">나</span>}
      </span>
      <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">정답 {entry.correct}</span>
      <span className="min-w-[4.5rem] text-right text-[15px] font-bold tabular-nums text-slate-900 dark:text-slate-100">{entry.total}점</span>
    </li>
  );
}

/**
 * 학생용 실시간 랭킹 — 열려 있을 때만 전체 점수를 구독한다(평소엔 내 점수만 구독).
 * 내 줄이 목록 밖에 있으면 아래에 내 순위를 고정해 보여준다.
 */
export default memo(function StudentRankingSheet({ sessionId, hidden = false }) {
  const { scores } = useScores(hidden ? null : sessionId);
  const participantId = getParticipantId();
  const ranking = useMemo(() => buildStudentRanking(scores), [scores]);
  const me = useMemo(() => myRankingSummary(ranking, participantId), [ranking, participantId]);
  const myRowRef = useRef(null);
  const [myRowVisible, setMyRowVisible] = useState(true);

  useEffect(() => {
    const node = myRowRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => setMyRowVisible(entry.isIntersecting), { threshold: 0.6 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [me?.id, ranking.length]);

  if (hidden) return (
    <div className="flex flex-col items-center gap-2 py-10 text-center text-slate-500 dark:text-slate-400">
      <EyeOff size={24} aria-hidden="true" />
      <p className="text-sm">지금은 강사가 랭킹을 숨겨 두었어요</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {me ? (
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 dark:bg-slate-700/40 p-3 text-center" aria-label="내 순위 요약">
          <div><p className="text-xs text-slate-500 dark:text-slate-400">내 순위</p><p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{me.rank}<span className="ml-0.5 text-sm font-medium text-slate-500">위</span></p></div>
          <div><p className="text-xs text-slate-500 dark:text-slate-400">총점</p><p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{me.total}</p></div>
          <div><p className="text-xs text-slate-500 dark:text-slate-400">정답</p><p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{me.correct}<span className="ml-0.5 text-sm font-medium text-slate-500">개</span></p></div>
          <p className="col-span-3 text-xs text-slate-500 dark:text-slate-400">{me.count}명 중 상위 {me.topPercent}%</p>
        </div>
      ) : (
        <p className="rounded-2xl bg-slate-50 dark:bg-slate-700/40 p-4 text-center text-sm text-slate-500 dark:text-slate-400">퀴즈에 답하면 내 순위가 여기에 나와요</p>
      )}

      {ranking.length === 0
        ? <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">아직 점수가 없어요</p>
        : (
          <ol className="max-h-[52dvh] overflow-y-auto overscroll-contain space-y-0.5 -mx-1 px-1" aria-label="전체 랭킹">
            {ranking.map(entry => (
              <RankRow key={entry.id} entry={entry} mine={entry.id === participantId} rowRef={entry.id === participantId ? myRowRef : undefined} />
            ))}
          </ol>
        )}

      {me && !myRowVisible && (
        <div className="sticky bottom-0 rounded-xl bg-white dark:bg-slate-800 shadow-lg ring-1 ring-slate-200 dark:ring-slate-700">
          <RankRow entry={me} mine />
        </div>
      )}
    </div>
  );
});
