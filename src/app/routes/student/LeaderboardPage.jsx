import { useMemo, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import StudentHeader from './StudentHeader';
import StudentBottomBar from './StudentBottomBar';
import Leaderboard from '@/features/quiz/components/Leaderboard';
import { useScores } from '@/features/quiz/api/useScores';
import { getParticipantId } from '@/lib/participant';
import { normalizeRankingHighlight } from '@/lib/ranking-highlight';
import './RankSummary.css';

const PAGE_SIZE = 8;

/** A compact summary stays in document flow; the ranking list has no pinned copy. */
function MyRankSummary({ rank, entry, total, featured, onOpen }) {
  if (!entry || rank <= 0) return null;
  const pct = Math.max(1, Math.min(100, Math.ceil(rank / total * 100)));
  const meta = `${total}명 중 · 상위 ${pct}%`;
  return <div aria-label="내 순위 요약" data-featured={featured ? 'true' : undefined}
    className={`student-rank-summary rounded-xl border bg-white dark:bg-slate-800 px-4 py-3 ${featured ? 'border-indigo-300 dark:border-indigo-700 ring-2 ring-indigo-400/50' : 'border-slate-200 dark:border-slate-700'}`}>
    {featured && <p className="mb-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300">특별 순위로 뽑혔어요</p>}
    <div className="student-rank-summary-layout">
      <div className="shrink-0">
        <p className="text-xs text-slate-500 dark:text-slate-400">내 순위</p>
        <p className="student-rank-summary-number text-3xl leading-none font-bold tabular-nums text-slate-900 dark:text-slate-100">{rank}<span className="ml-0.5 text-sm font-medium text-slate-500 dark:text-slate-400">위</span></p>
      </div>
      <div className="student-rank-summary-score min-w-0 text-center">
        <p className="whitespace-nowrap text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">{entry.total}점</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{meta}</p>
      </div>
      <p className="student-rank-summary-compact-meta text-xs text-slate-500 dark:text-slate-400">{meta}</p>
      <button type="button" onClick={onOpen} aria-label="내 순위 페이지로 이동" className="student-rank-summary-view inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-lg border border-slate-200 dark:border-slate-600 px-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">보기<ArrowRight size={16} /></button>
    </div>
  </div>;
}

export default function LeaderboardPage({ sessionId, highlight = null }) {
  const { leaderboard } = useScores(sessionId);
  const participantId = getParticipantId();
  const [page, setPage] = useState(0);
  const listRef = useRef(null);
  const { myRank, myEntry } = useMemo(() => {
    const idx = leaderboard.findIndex(entry => entry.id === participantId);
    return { myRank: idx >= 0 ? idx + 1 : 0, myEntry: idx >= 0 ? leaderboard[idx] : null };
  }, [leaderboard, participantId]);
  const featuredMe = myRank > 0 && normalizeRankingHighlight(highlight)?.activeRank === myRank;

  function openMyRank() {
    if (myRank <= 0) return;
    setPage(Math.floor((myRank - 1) / PAGE_SIZE));
    // Avoid a second fixed card or scrolling the whole page through a long list.
    listRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }

  return <div className="h-dvh overflow-y-auto overscroll-contain bg-slate-50 dark:bg-slate-900 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-[calc(5rem+env(safe-area-inset-top))]">
    <StudentHeader sessionId={sessionId} />
    <div className="mx-auto w-full max-w-md space-y-4">
      <MyRankSummary rank={myRank} entry={myEntry} total={leaderboard.length} featured={featuredMe} onOpen={openMyRank} />
      <div ref={listRef} className="scroll-mt-20">
        <Leaderboard entries={leaderboard} paginate pageSize={PAGE_SIZE} page={page} onPageChange={setPage}
          highlight={highlight}
          title="현재 리더보드" highlightId={participantId} emptyLabel="아직 점수가 집계되지 않았습니다" />
      </div>
    </div>
    <StudentBottomBar sessionId={sessionId} />
  </div>;
}
