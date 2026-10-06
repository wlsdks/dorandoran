import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState, memo, useCallback } from 'react';
import { Trophy, ChevronLeft, ChevronRight } from 'lucide-react';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import LeaderboardRow from './LeaderboardRow';
import RankingHighlightControls from './RankingHighlightControls';
import { normalizeRankingHighlight, rankingHighlightEntry } from '@/lib/ranking-highlight';
import './Leaderboard.css';

const EMPTY_ENTRIES = [];
const clampPage = (value, count) => Math.max(0, Math.min(count - 1, Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0));
// Preserve native Space/Enter clicks without letting Presenter Space advance the lesson.
const keepLocal = event => { if (event.key === ' ' || event.key === 'Enter') event.stopPropagation(); };

function Pager({ presenter, page, pageCount, onPrev, onNext }) {
  const prev = { 'aria-label': '이전 랭킹 페이지', onKeyDown: keepLocal, onClick: onPrev, disabled: page === 0, type: 'button' };
  const next = { 'aria-label': '다음 랭킹 페이지', onKeyDown: keepLocal, onClick: onNext, disabled: page >= pageCount - 1, type: 'button' };
  const position = <span aria-label="랭킹 페이지 위치" aria-live="polite">{page + 1} / {pageCount}</span>;
  if (presenter) return <nav aria-label="랭킹 페이지" className="board-ranking-pager">
    <button {...prev}><ChevronLeft /></button>{position}<button {...next}><ChevronRight /></button>
  </nav>;
  const button = 'inline-flex min-h-12 flex-1 items-center justify-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent';
  return <nav aria-label="랭킹 페이지" className="mt-3 flex items-stretch overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
    <button {...prev} className={button}><ChevronLeft size={16} />이전</button>
    <div className="flex min-w-[5.5rem] items-center justify-center border-x border-slate-200 dark:border-slate-700 text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">{position}</div>
    <button {...next} className={button}>다음<ChevronRight size={16} /></button>
  </nav>;
}

/**
 * Legacy summaries keep maxShow as their total cap. Presenter and explicit
 * paginate views show every entry with manual pages. page is zero-based; an
 * external page change synchronizes viewers, but viewers can still browse locally.
 */
export default memo(function Leaderboard({
  entries, maxShow = 10, title = '랭킹', emptyLabel = '아직 점수가 없습니다', highlightId = null,
  presenter = false, paginate = false, pageSize = 8, page, onPageChange, highlight = null, onHighlightChange,
}) {
  const ranked = Array.isArray(entries) ? entries : EMPTY_ENTRIES;
  const paginated = presenter || paginate;
  const size = Math.max(1, Math.min(presenter ? 8 : 20, Number.isFinite(pageSize) ? Math.trunc(pageSize) : 8));
  const totalShown = paginated ? ranked.length : Math.min(ranked.length, Math.max(0, maxShow));
  const pageCount = paginated ? Math.max(1, Math.ceil(totalShown / size)) : 1;
  const [localPage, setLocalPage] = useState(() => clampPage(page, pageCount));
  const currentPage = clampPage(localPage, pageCount);
  const offset = paginated ? currentPage * size : 0;
  const visible = ranked.slice(offset, paginated ? offset + size : totalShown);
  const featured = normalizeRankingHighlight(highlight);
  const featuredRank = featured?.activeRank ?? null;
  const featuredEntry = rankingHighlightEntry(ranked, featured);
  const featuredOnPage = Boolean(featured && featured.activeRank > offset && featured.activeRank <= offset + visible.length);
  const reducedMotion = useReducedMotion();
  const swipeStart = useRef(null);
  const previousExternalPage = useRef(page);
  const previousHighlightRank = useRef(null);
  const hadEntries = useRef(false);
  const prevRanksRef = useRef(Object.create(null));
  const [rankDeltas, setRankDeltas] = useState(Object.create(null));

  useEffect(() => {
    const externalChanged = page !== previousExternalPage.current;
    const firstLoadedList = ranked.length > 0 && !hadEntries.current;
    previousExternalPage.current = page;
    hadEntries.current = ranked.length > 0;
    if (page !== undefined && (externalChanged || firstLoadedList)) setLocalPage(clampPage(page, pageCount));
  }, [page, pageCount, ranked.length]);

  useEffect(() => { setLocalPage(value => clampPage(value, pageCount)); }, [pageCount]);

  useEffect(() => {
    // A new special rank is also a navigation command for the board, including
    // when two ranks share the same external page. Student browsing stays local,
    // and list-size changes alone never repeat this command.
    if (featuredRank === null) { previousHighlightRank.current = null; return; }
    if (!presenter || !paginated || ranked.length === 0 || featuredRank === previousHighlightRank.current) return;
    previousHighlightRank.current = featuredRank;
    setLocalPage(clampPage(Math.floor((featuredRank - 1) / size), pageCount));
  }, [featuredRank, paginated, presenter, ranked.length, size, pageCount]);

  useEffect(() => {
    const next = Object.create(null), deltas = Object.create(null);
    ranked.forEach((entry, rank) => {
      next[entry.id] = rank;
      if (prevRanksRef.current[entry.id] !== undefined) deltas[entry.id] = prevRanksRef.current[entry.id] - rank;
    });
    prevRanksRef.current = next;
    setRankDeltas(deltas);
  }, [ranked]);

  const goToPage = useCallback(value => {
    const next = clampPage(value, pageCount);
    if (next === currentPage) return;
    setLocalPage(next);
    onPageChange?.(next);
  }, [currentPage, onPageChange, pageCount]);

  const handleKeyboard = useCallback(event => {
    if (!paginated || event.defaultPrevented || event.target?.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]')) return;
    let next;
    if (event.key === 'ArrowLeft') next = currentPage - 1;
    else if (event.key === 'ArrowRight') next = currentPage + 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = pageCount - 1;
    else return;
    event.preventDefault();
    event.stopPropagation();
    goToPage(next);
  }, [currentPage, goToPage, pageCount, paginated]);

  // Presenter keyboard navigation takes priority over the surrounding slide/question shortcuts.
  useEffect(() => {
    if (!presenter || !paginated || ranked.length === 0) return;
    document.addEventListener('keydown', handleKeyboard, true);
    return () => document.removeEventListener('keydown', handleKeyboard, true);
  }, [handleKeyboard, paginated, presenter, ranked.length]);

  const handlePointerDown = event => {
    if (!paginated || event.pointerType === 'mouse' || event.target.closest('button,a,input,textarea,select')) return;
    swipeStart.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    if (event.isTrusted) event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const handlePointerUp = event => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy) * 1.25) return;
    event.preventDefault();
    event.stopPropagation();
    goToPage(currentPage + (dx < 0 ? 1 : -1));
  };

  if (ranked.length === 0 || totalShown === 0) return presenter
    ? <section aria-label={title || '랭킹'} className="board-ranking"><div className="board-ranking-empty"><DoranDoranMascot size="md" /><p>{emptyLabel}</p><p>퀴즈에 정답을 맞히면 점수가 올라갑니다</p></div></section>
    : <div className="flex flex-col items-center space-y-2 py-8 text-center"><DoranDoranMascot size="sm" /><p className="text-sm text-slate-400">{emptyLabel}</p><p className="text-xs text-slate-400 dark:text-slate-500">퀴즈에 정답을 맞히면 점수가 올라갑니다</p></div>;

  const myIndex = highlightId ? ranked.findIndex(entry => entry.id === highlightId) : -1;
  const legacyOwnRow = !paginated && myIndex >= totalShown;
  const pager = paginated && pageCount > 1 && <Pager presenter={presenter} page={currentPage} pageCount={pageCount} onPrev={() => goToPage(currentPage - 1)} onNext={() => goToPage(currentPage + 1)} />;
  const featuredPage = featured ? Math.floor((featured.activeRank - 1) / size) : 0;
  const rows = <div onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerCancel={() => { swipeStart.current = null; }} style={{ touchAction: 'pan-y' }}>
    <motion.ol key={currentPage} start={offset + 1} initial={reducedMotion ? false : { opacity: 0, x: 5 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.14 }} className={presenter ? 'board-ranking-list' : 'space-y-2'}>
      {visible.map((entry, index) => {
        const rank = offset + index;
        return <li key={entry.id} data-podium={rank < 3 ? 'true' : 'false'}>
          <LeaderboardRow entry={entry} rank={rank} orderIndex={index} presenter={presenter} reducedMotion={reducedMotion}
            isFeatured={featuredRank === rank + 1} isDimmed={featuredOnPage && featuredRank !== rank + 1}
            isHighlighted={entry.id === highlightId} rankDelta={rankDeltas[entry.id] || 0} />
        </li>;
      })}
    </motion.ol>
  </div>;

  if (presenter) return <section aria-label={title || '랭킹'} tabIndex={0} className="board-ranking">
    <header className="board-ranking-header">
      <div className="min-w-0">
        {title && <h3 className="board-ranking-title">{title}</h3>}
        <p className="board-ranking-meta">{ranked.length}명 참여{featured ? ` · 특별 순위 ${featured.activeRank}위${!featuredOnPage && featuredEntry ? ` ${featuredEntry.nickname}` : ''}` : ''}</p>
      </div>
      {pager}
    </header>
    {rows}
  </section>;

  return <section aria-label={title || '랭킹'} tabIndex={paginated ? 0 : undefined} onKeyDown={handleKeyboard} className="mx-auto w-full max-w-md">
    {(title || onHighlightChange) && <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      {title && <h3 className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100"><Trophy size={20} className="text-slate-500" />{title}</h3>}
      {onHighlightChange && <RankingHighlightControls highlight={highlight} onHighlightChange={onHighlightChange} maxRank={ranked.length} />}
    </div>}
    {featured && !featuredOnPage && <div aria-label="현재 강조 순위" className="mb-3 flex items-center gap-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 px-4 py-2.5">
      <span className="shrink-0 text-sm font-semibold text-indigo-700 dark:text-indigo-300">특별 순위 {featured.activeRank}위</span>
      <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{featuredEntry?.nickname || '현재 목록에 없습니다'}</span>
      {featuredEntry && paginated && <button type="button" onKeyDown={keepLocal} onClick={() => goToPage(featuredPage)} aria-label="현재 강조 순위 보기" className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">보기<ChevronRight size={14} /></button>}
    </div>}
    {rows}
    {pager}
    {legacyOwnRow && <div className="mt-4 border-t border-dashed border-slate-200 dark:border-slate-700 pt-3">
      <LeaderboardRow entry={ranked[myIndex]} rank={myIndex} orderIndex={0} isHighlighted rankDelta={rankDeltas[highlightId] || 0} reducedMotion={reducedMotion} />
    </div>}
  </section>;
});
