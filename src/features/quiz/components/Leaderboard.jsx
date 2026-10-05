import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState, memo, useCallback } from 'react';
import { Trophy, Crown } from 'lucide-react';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import LeaderboardRow from './LeaderboardRow';
import AnimatedScore from './AnimatedScore';

export default memo(function Leaderboard({
  entries,
  maxShow = 10,
  title = '리더보드',
  emptyLabel = '아직 점수가 없습니다',
  highlightId = null,
  presenter = false,
}) {
  const visible = entries.slice(0, maxShow);

  // Track previous ranks for rank-change indicators — state for reactivity
  const prevRanksRef = useRef({});
  const [rankDeltas, setRankDeltas] = useState({});

  const computeDeltas = useCallback(() => {
    // Only compute ranks for visible entries + highlighted entry (not all 300)
    const relevantEntries = entries.slice(0, maxShow + 5);
    const newRanks = Object.create(null);
    relevantEntries.forEach((entry, i) => { newRanks[entry.id] = i; });
    if (highlightId) {
      const hIdx = entries.findIndex(e => e.id === highlightId);
      if (hIdx >= 0) newRanks[highlightId] = hIdx;
    }

    const prev = prevRanksRef.current;
    const deltas = Object.create(null);
    Object.keys(newRanks).forEach((id) => {
      if (prev[id] !== undefined) {
        deltas[id] = prev[id] - newRanks[id];
      }
    });

    prevRanksRef.current = newRanks;
    setRankDeltas(deltas);
  }, [entries, maxShow, highlightId]);

  useEffect(() => {
    computeDeltas();
  }, [computeDeltas]);

  const [displayPage, setDisplayPage] = useState(0);
  const displayPages = Math.max(1, Math.ceil(visible.length / 6));
  useEffect(() => {
    if (!presenter || displayPages < 2) return;
    const timer = setInterval(() => setDisplayPage(page => (page + 1) % displayPages), 10000);
    return () => clearInterval(timer);
  }, [presenter, displayPages]);

  if (visible.length === 0) {
    return (
      <div className="text-center py-10 space-y-2 flex flex-col items-center">
        <DoranDoranMascot size={presenter ? "lg" : "sm"} />
        <p className={presenter ? "text-3xl font-semibold text-slate-100" : "text-slate-400 text-sm"}>{emptyLabel}</p>
        <p className={presenter ? "text-2xl text-slate-300" : "text-slate-400 dark:text-slate-500 text-xs"}>퀴즈에 정답을 맞히면 점수가 올라갑니다</p>
      </div>
    );
  }

  if (presenter) {
    const offset = (displayPage % displayPages) * 6;
    return <div className="paper-surface max-w-[1100px] space-y-6">
      {title && <h3 className="classroom-question-title font-bold text-center">{title}</h3>}
      <ol className="space-y-2.5" start={offset + 1}>
        {visible.slice(offset, offset + 6).map((entry, index) => {
          const rank = offset + index;
          return <motion.li key={entry.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className={`flex items-center gap-5 min-h-16 px-6 py-3 rounded-xl ${rank === 0 ? 'bg-indigo-100 text-indigo-950' : 'bg-slate-700/60 text-slate-100'}`}>
            <span className="w-10 shrink-0 text-center text-2xl font-bold tabular-nums">
              {rank === 0 ? <Crown size={28} className="mx-auto" /> : rank + 1}
            </span>
            <span className="flex-1 min-w-0 text-2xl md:text-3xl font-semibold break-words">{entry.nickname || '참여자'}</span>
            <span className="text-2xl md:text-3xl font-bold tabular-nums shrink-0"><AnimatedScore value={Number(entry.total) || 0} /></span>
          </motion.li>;
        })}
      </ol>
      {displayPages > 1 && <p className="text-center text-lg text-slate-300">순위 {offset + 1}–{Math.min(offset + 6, visible.length)} · {displayPage % displayPages + 1} / {displayPages} · 10초마다 다음 순위</p>}
    </div>;
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-2">
      {title && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="flex items-center gap-2 mb-4"
        >
          <Trophy size={20} className="text-slate-500" />
          <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">{title}</h3>
        </motion.div>
      )}

      <AnimatePresence initial={false}>
        {visible.map((entry, i) => (
          <LeaderboardRow
            key={entry.id}
            entry={entry}
            rank={i}
            isHighlighted={entry.id === highlightId}
            isPodium={i < 3}
            podiumIndex={i}
            rankDelta={rankDeltas[entry.id] || 0}
          />
        ))}
      </AnimatePresence>

      {/* 10위 밖일 때 내 순위 고정 표시 */}
      {highlightId && !visible.some((e) => e.id === highlightId) && (() => {
        const myIndex = entries.findIndex((e) => e.id === highlightId);
        if (myIndex < 0) return null;
        const myEntry = entries[myIndex];
        return (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.2 }}
            className="mt-4 pt-3 border-t border-dashed border-slate-200 dark:border-slate-700"
          >
            <LeaderboardRow
              entry={myEntry}
              rank={myIndex}
              isHighlighted
              isPodium={false}
              podiumIndex={-1}
              rankDelta={rankDeltas[myEntry.id] || 0}
            />
          </motion.div>
        );
      })()}
    </div>
  );
});
