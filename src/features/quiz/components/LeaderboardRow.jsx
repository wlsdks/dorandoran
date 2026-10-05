import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { ChevronUp, ChevronDown, Crown, Flame, Medal } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import AnimatedScore from './AnimatedScore';

/** Shows rank change indicator — auto-hides after 8s. */
function RankChange({
  delta
}) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 8000);
    return () => clearTimeout(timer);
  }, [delta]);
  if (delta === 0 || !visible) return null;
  const isUp = delta > 0;
  return <AnimatePresence>
      <motion.span key={delta} initial={{
      opacity: 0,
      scale: 0.5,
      y: isUp ? 4 : -4
    }} animate={{
      opacity: 1,
      scale: 1,
      y: 0
    }} exit={{
      opacity: 0,
      scale: 0.8
    }} transition={{
      type: 'spring',
      stiffness: 400,
      damping: 22
    }} className={`inline-flex items-center gap-0.5 text-xs font-bold ${isUp ? 'text-emerald-500' : 'text-red-400'}`}>
        {isUp ? <ChevronUp size={13} strokeWidth={2.5} /> : <ChevronDown size={13} strokeWidth={2.5} />}
        {Math.abs(delta)}
      </motion.span>
    </AnimatePresence>;
}

/** Floating score delta that rises and fades — Kahoot-style. */
function ScoreDelta({
  points,
  questionId,
  isLeader
}) {
  if (!points || points <= 0) return null;
  return <AnimatePresence mode="popLayout">
      <motion.span key={`${points}-${questionId}`} initial={{
      opacity: 0,
      y: 0,
      scale: 0.8
    }} animate={{
      opacity: 1,
      y: -2,
      scale: 1
    }} exit={{
      opacity: 0,
      y: -12,
      scale: 0.9
    }} transition={{
      type: 'spring',
      stiffness: 300,
      damping: 25
    }} className={`text-xs font-bold tabular-nums ${isLeader ? 'text-white/80 dark:text-slate-900/70' : 'text-emerald-500 dark:text-emerald-400'}`}>
        +{points}
      </motion.span>
    </AnimatePresence>;
}

/** Animated crown for 1st place — bounces when leader changes. */
function AnimatedCrown({
  leaderId,
  presenter = false,
  featured = false,
}) {
  return <motion.span key={leaderId} initial={{
    scale: 0.4,
    rotate: -20,
    opacity: 0
  }} animate={{
    scale: 1,
    rotate: 0,
    opacity: 1
  }} transition={{
    type: 'spring',
    stiffness: 500,
    damping: 18
  }} className="inline-flex justify-center w-full">
      <Crown size={18} style={presenter ? { width: 'clamp(18px, 1.32vw, 30px)', height: 'clamp(18px, 1.32vw, 30px)' } : undefined} className={featured ? 'text-indigo-700 dark:text-indigo-200' : presenter ? 'text-indigo-950' : 'text-white dark:text-slate-900'} />
    </motion.span>;
}
const PODIUM_STYLES = ['bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100', 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600', 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'];

/** Single leaderboard row with rank-up flash effect. */
export default function LeaderboardRow({
  entry,
  rank,
  isHighlighted,
  isPodium,
  podiumIndex,
  rankDelta,
  presenter = false,
  orderIndex = 0,
  reducedMotion = false,
  isFeatured = false,
  isHighlightCandidate = false,
}) {
  const isLeader = rank === 0;
  const podiumStyle = isFeatured ? presenter ? 'bg-indigo-950/80 text-indigo-50 border-indigo-300' : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-100 border-indigo-400'
    : presenter ? isLeader ? 'bg-indigo-100 text-indigo-950 border-indigo-100' : 'bg-slate-700/45 text-slate-100 border-transparent'
    : isPodium ? PODIUM_STYLES[podiumIndex] : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700';
  const highlightStyle = isHighlighted && !isPodium ? 'ring-2 ring-slate-900/20 dark:ring-slate-400/30 border-slate-400 dark:border-slate-500 bg-slate-50 dark:bg-slate-700' : isHighlighted && isPodium ? 'ring-2 ring-white/30' : '';

  // Rank-up flash: brief emerald overlay when rank improved
  const [showFlash, setShowFlash] = useState(false);
  const prevDeltaRef = useRef(0);
  useEffect(() => {
    const previous = prevDeltaRef.current;
    prevDeltaRef.current = rankDelta;
    if (!reducedMotion && rankDelta > 0 && rankDelta !== previous) {
      setShowFlash(true);
      const t = setTimeout(() => setShowFlash(false), 600);
      return () => clearTimeout(t);
    }
    setShowFlash(false);
  }, [rankDelta, reducedMotion]);
  return <motion.div layout={reducedMotion ? false : 'position'} initial={reducedMotion ? false : {
    opacity: 0,
    y: 4
  }} animate={{
    opacity: 1,
    scale: 1,
    y: 0,
    x: 0
  }} transition={{
    layout: {
      type: 'spring',
      stiffness: 500,
      damping: 30
    },
    delay: Math.min(orderIndex, 5) * 0.018,
    type: 'spring',
    stiffness: isLeader ? 500 : 300,
    damping: isLeader ? 22 : 25
  }} data-ranking-featured={isFeatured ? 'true' : undefined} data-rank={rank + 1} style={{ ...(presenter ? { minHeight: 'clamp(44px, 3.22vw, 92px)' } : {}), boxShadow: isFeatured ? 'inset 4px 0 0 #a5b4fc' : 'none' }} className={`relative flex items-center ${presenter ? 'gap-3 px-4 py-1.5 rounded-lg' : 'gap-2.5 min-h-14 px-3 py-2 rounded-xl'} border overflow-hidden transition-colors ${reducedMotion ? 'duration-0' : 'duration-250'} ${podiumStyle} ${isFeatured ? '' : highlightStyle} ${isHighlightCandidate && !isFeatured ? 'ring-1 ring-inset ring-indigo-400/40' : ''}`}>
      {/* Rank-up flash overlay */}
      <AnimatePresence>
        {showFlash && <motion.div key="flash" initial={{
        opacity: 0.35
      }} animate={{
        opacity: 0
      }} transition={{
        duration: 0.4,
        ease: 'easeOut'
      }} className="absolute inset-0 bg-emerald-400 pointer-events-none" />}
      </AnimatePresence>

      {/* Rank number / crown / medal */}
      <span style={presenter ? { width: 'clamp(36px, 2.64vw, 68px)', fontSize: 'clamp(18px, 1.3vw, 30px)' } : undefined} className={`${presenter ? 'leading-tight' : 'w-6 text-sm'} text-center font-bold shrink-0 tabular-nums ${rank >= 3 ? presenter ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400' : ''}`} aria-label={`${rank + 1}위`}>
        {isLeader ? <AnimatedCrown leaderId={entry.id} presenter={presenter} featured={isFeatured} /> : !presenter && rank === 1 ? <Medal size={16} className="mx-auto" /> : rank + 1}
      </span>

      {!presenter && <Avatar name={entry.nickname} size="sm" />}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={presenter ? 'font-semibold text-[clamp(20px,1.55vw,42px)] leading-tight truncate' : 'font-medium text-sm truncate'}>{entry.nickname || '참여자'}</span>
          {isHighlighted && <span className={`shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded-md ${isFeatured ? 'bg-indigo-600 text-white' : isLeader ? 'bg-white/20 text-white dark:text-slate-900' : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'}`}>나</span>}
          {presenter && isFeatured && <span className="shrink-0 rounded-md bg-indigo-400/20 px-2 py-1 font-semibold text-indigo-100 text-[clamp(11px,.85vw,22px)]">강조 순위</span>}
        </div>
        {!presenter && <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
          {isFeatured && <span className="font-semibold text-indigo-700 dark:text-indigo-200">강조 순위</span>}
          {rankDelta !== 0 && <RankChange delta={rankDelta} />}
          {(entry.streak || 0) > 1 && <span className={`inline-flex items-center gap-0.5 font-medium ${(entry.streak || 0) >= 3 ? 'text-amber-500' : ''}`}>
              <Flame size={13} />
              {entry.streak}연속
            </span>}

        </div>}
      </div>

      <div className="text-right shrink-0 min-w-[56px]">
        <span className={`font-bold block ${presenter ? `text-[clamp(22px,1.7vw,46px)] leading-tight ${isFeatured ? 'text-indigo-50' : isLeader ? 'text-indigo-950' : 'text-slate-100'}` : `text-sm ${isFeatured ? 'text-indigo-950 dark:text-indigo-50' : isLeader ? 'text-white dark:text-slate-900' : 'text-slate-900 dark:text-slate-100'}`}`}>
          <AnimatedScore value={Number(entry.total) || 0} />
        </span>
        {!presenter && <ScoreDelta points={entry.lastPoints} questionId={entry.lastQuestionId} isLeader={isLeader} />}
      </div>
    </motion.div>;
}
