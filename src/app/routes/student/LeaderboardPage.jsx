import { useMemo, useRef, useState } from 'react';
import { Trophy, ArrowRight } from 'lucide-react';
import StudentHeader from './StudentHeader';
import StudentBottomBar from './StudentBottomBar';
import Leaderboard from '@/features/quiz/components/Leaderboard';
import { useScores } from '@/features/quiz/api/useScores';
import { getParticipantId } from '@/lib/participant';

const PAGE_SIZE = 8;

/** A compact summary stays in document flow; the ranking list has no pinned copy. */
function MyRankSummary({ rank, entry, total, onOpen }) {
  if (!entry || rank <= 0) return null;
  const pct = Math.max(1, Math.min(100, Math.ceil(rank / total * 100)));
  return <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3" aria-label="내 순위 요약">
    <div className="shrink-0">
      <p className="text-xs text-slate-500 dark:text-slate-400">내 순위</p>
      <p className="text-2xl leading-tight font-bold tabular-nums text-slate-900 dark:text-slate-100">{rank}<span className="ml-1 text-sm font-medium text-slate-500 dark:text-slate-400">위</span></p>
    </div>
    <div className="min-w-0 flex-1 text-center">
      <p className="flex items-center justify-center gap-1 text-base font-semibold tabular-nums text-slate-700 dark:text-slate-200"><Trophy size={14} className="shrink-0" />{entry.total}점</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{total}명 · 상위 {pct}%</p>
    </div>
    <button type="button" onClick={onOpen} aria-label="내 순위 페이지로 이동" className="inline-flex min-h-11 items-center justify-center gap-1 shrink-0 rounded-lg px-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">보기<ArrowRight size={16} /></button>
  </div>;
}

export default function LeaderboardPage({ sessionId }) {
  const { leaderboard } = useScores(sessionId);
  const participantId = getParticipantId();
  const [page, setPage] = useState(0);
  const listRef = useRef(null);
  const { myRank, myEntry } = useMemo(() => {
    const idx = leaderboard.findIndex(entry => entry.id === participantId);
    return { myRank: idx >= 0 ? idx + 1 : 0, myEntry: idx >= 0 ? leaderboard[idx] : null };
  }, [leaderboard, participantId]);

  function openMyRank() {
    if (myRank <= 0) return;
    setPage(Math.floor((myRank - 1) / PAGE_SIZE));
    // Avoid a second fixed card or scrolling the whole page through a long list.
    listRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }

  return <div className="h-dvh overflow-y-auto overscroll-contain bg-slate-50 dark:bg-slate-900 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-20">
    <StudentHeader sessionId={sessionId} />
    <div className="w-full max-w-md mx-auto space-y-4">
      <MyRankSummary rank={myRank} entry={myEntry} total={leaderboard.length} onOpen={openMyRank} />
      <div ref={listRef} className="scroll-mt-20">
        <Leaderboard entries={leaderboard} paginate pageSize={PAGE_SIZE} page={page} onPageChange={setPage}
          title="현재 리더보드" highlightId={participantId} emptyLabel="아직 점수가 집계되지 않았습니다" />
      </div>
    </div>
    <StudentBottomBar sessionId={sessionId} />
  </div>;
}
