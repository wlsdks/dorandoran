import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState, memo, useCallback } from 'react';
import { Trophy, ChevronLeft, ChevronRight } from 'lucide-react';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import LeaderboardRow from './LeaderboardRow';
import RankingHighlightControls from './RankingHighlightControls';
import { normalizeRankingHighlight, rankingHighlightEntry } from '@/lib/ranking-highlight';

const EMPTY_ENTRIES = [];
const clampPage = (value, count) => Math.max(0, Math.min(count - 1, Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0));
const STAGE_STYLE = {
  width: 'min(100%, clamp(960px, 70.28vw, 1800px))',
  paddingInline: 'clamp(20px, 1.4vw, 44px)',
  paddingBlock: 'clamp(16px, 1.17vw, 32px)',
};
const STAGE_PAGER_STYLE = {
  minHeight: 'clamp(44px, 3.22vw, 68px)',
  paddingInline: 'clamp(12px, .88vw, 24px)',
  fontSize: 'clamp(14px, .9vw, 24px)',
};
const STAGE_PAGER_ICON_STYLE = { width: 'clamp(16px, 1.17vw, 26px)', height: 'clamp(16px, 1.17vw, 26px)' };

/**
 * Legacy summaries keep maxShow as their total cap. Presenter and explicit
 * paginate views show every entry with manual pages. page is zero-based; an
 * external page change synchronizes viewers, but viewers can still browse locally.
 */
export default memo(function Leaderboard({
  entries,
  maxShow = 10,
  title = '리더보드',
  emptyLabel = '아직 점수가 없습니다',
  highlightId = null,
  presenter = false,
  paginate = false,
  pageSize = 8,
  page,
  onPageChange,
  highlight = null,
  onHighlightChange,
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
  const featuredOnPage = featured && featured.activeRank > offset && featured.activeRank <= offset + visible.length;
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

  useEffect(() => {
    setLocalPage(value => clampPage(value, pageCount));
  }, [pageCount]);

  useEffect(() => {
    // A new teacher highlight is also a navigation command for the board,
    // including when two ranks share the same external page. Student browsing
    // stays local, and list-size changes alone never repeat this command.
    if (featuredRank === null) {
      previousHighlightRank.current = null;
      return;
    }
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

  // Presenter keyboard navigation takes priority over the surrounding slide/
  // question shortcuts, even after clicking fullscreen or another toolbar button.
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

  if (ranked.length === 0 || totalShown === 0) return <div className="text-center py-8 space-y-2 flex flex-col items-center">
    <DoranDoranMascot size={presenter ? 'md' : 'sm'} />
    <p className={presenter ? 'text-2xl font-semibold text-slate-100' : 'text-slate-400 text-sm'}>{emptyLabel}</p>
    <p className={presenter ? 'text-lg text-slate-300' : 'text-slate-400 dark:text-slate-500 text-xs'}>퀴즈에 정답을 맞히면 점수가 올라갑니다</p>
  </div>;

  const myIndex = highlightId ? ranked.findIndex(entry => entry.id === highlightId) : -1;
  const legacyOwnRow = !paginated && myIndex >= totalShown;
  const pagerButton = `inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${presenter ? 'text-slate-200 hover:bg-slate-700 border border-slate-600' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600'}`;
  const keepButtonActivationLocal = event => {
    // Preserve native Space/Enter clicks without allowing Presenter Space to
    // advance the lesson while someone activates a ranking pager button.
    if (event.key === ' ' || event.key === 'Enter') event.stopPropagation();
  };

  return <section
    aria-label={title || '리더보드'} tabIndex={paginated ? 0 : undefined}
    onKeyDown={!presenter ? handleKeyboard : undefined}
    style={presenter ? STAGE_STYLE : undefined}
    className={presenter ? 'mx-auto rounded-2xl border border-slate-700 bg-slate-800' : 'w-full max-w-md mx-auto space-y-2'}
  >
    {(title || onHighlightChange) && <div className={presenter ? 'flex flex-wrap items-center justify-between gap-3 mb-3' : 'flex flex-wrap items-center gap-2 mb-3'}>
      <div className={`flex items-center gap-2 ${presenter ? 'flex-1 justify-center' : ''}`}>
      {!presenter && <Trophy size={20} className="text-slate-500" />}
      {title && <h3 className={presenter ? 'text-[clamp(22px,2vw,48px)] leading-tight font-bold tracking-tight text-slate-100' : 'text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100'}>{title}</h3>}
      </div>
      {onHighlightChange && <RankingHighlightControls highlight={highlight} onHighlightChange={onHighlightChange} maxRank={ranked.length} />}
    </div>}

    {featured && !featuredOnPage && <div aria-label="현재 강조 순위" className="flex items-center gap-3 mb-3 rounded-xl border border-indigo-400/50 bg-indigo-950/60 px-3 py-2 text-indigo-100">
      <span className="shrink-0 text-sm font-semibold">강조 순위 {featured.activeRank}위</span>
      <span className="min-w-0 flex-1 truncate text-sm">{featuredEntry?.nickname || '현재 목록에 없습니다'}</span>
      {featuredEntry && paginated && <button type="button" onKeyDown={keepButtonActivationLocal} onClick={() => goToPage(Math.floor((featured.activeRank - 1) / size))} aria-label="현재 강조 순위 보기" className="min-h-11 shrink-0 rounded-lg px-2 text-sm font-semibold hover:bg-indigo-900">보기<ChevronRight size={14} className="inline" /></button>}
    </div>}

    <div onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerCancel={() => { swipeStart.current = null; }} style={{ touchAction: 'pan-y' }}>
      <motion.ol key={currentPage} start={offset + 1} initial={reducedMotion ? false : { opacity: 0, x: 5 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.14 }} className={presenter ? 'flex flex-col' : 'space-y-2'} style={presenter ? { gap: 'clamp(4px, .292vw, 10px)' } : undefined}>
        {visible.map((entry, index) => <li key={entry.id}>
          <LeaderboardRow entry={entry} rank={offset + index} orderIndex={index} presenter={presenter} reducedMotion={reducedMotion}
            isFeatured={featured?.activeRank === offset + index + 1} isHighlightCandidate={featured?.ranks.includes(offset + index + 1)}
            isHighlighted={entry.id === highlightId} isPodium={offset + index < 3} podiumIndex={offset + index} rankDelta={rankDeltas[entry.id] || 0} />
        </li>)}
      </motion.ol>
    </div>

    {paginated && pageCount > 1 && <nav aria-label="리더보드 페이지" className="flex items-center justify-center gap-3 mt-3">
      <button type="button" aria-label="이전 랭킹 페이지" style={presenter ? STAGE_PAGER_STYLE : undefined} onKeyDown={keepButtonActivationLocal} onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 0} className={pagerButton}><ChevronLeft size={16} style={presenter ? STAGE_PAGER_ICON_STYLE : undefined} />이전</button>
      <span aria-label="리더보드 페이지 위치" aria-live="polite" style={presenter ? { fontSize: STAGE_PAGER_STYLE.fontSize } : undefined} className={`min-w-14 text-center text-sm tabular-nums ${presenter ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>{currentPage + 1} / {pageCount}</span>
      <button type="button" aria-label="다음 랭킹 페이지" style={presenter ? STAGE_PAGER_STYLE : undefined} onKeyDown={keepButtonActivationLocal} onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= pageCount - 1} className={pagerButton}>다음<ChevronRight size={16} style={presenter ? STAGE_PAGER_ICON_STYLE : undefined} /></button>
    </nav>}

    {legacyOwnRow && <div className="mt-4 pt-3 border-t border-dashed border-slate-200 dark:border-slate-700">
      <LeaderboardRow entry={ranked[myIndex]} rank={myIndex} orderIndex={0} isHighlighted isPodium={false} podiumIndex={-1} rankDelta={rankDeltas[highlightId] || 0} reducedMotion={reducedMotion} />
    </div>}
  </section>;
});
