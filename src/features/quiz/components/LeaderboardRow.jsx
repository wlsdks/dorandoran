import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { spring, settle, dim, stagger } from '@/lib/motion';
import { ChevronUp, ChevronDown, Flame } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import AnimatedScore from './AnimatedScore';

const SPRING = spring.default;

/** 첫 그림에서만 줄마다 조금씩 늦게 나오고, 그 뒤의 상태 변화(흐려짐·강조)는 바로 움직인다. */
function useEntryDelay(orderIndex) {
  const [entered, setEntered] = useState(false);
  useEffect(() => { setEntered(true); }, []);
  return entered ? 0 : stagger(orderIndex);
}
const SPARKS = [{ left: '6%', top: '10%', animationDelay: '.38s' }, { left: '3.5%', bottom: '8%', width: '.42em', height: '.42em', animationDelay: '.6s' }, { right: '7%', top: '14%', animationDelay: '.74s' }];

/** Rank change indicator — auto-hides after 8s. */
function RankChange({ delta }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 8000);
    return () => clearTimeout(timer);
  }, [delta]);
  if (delta === 0 || !visible) return null;
  const isUp = delta > 0;
  return <AnimatePresence>
    <motion.span key={delta} initial={{ opacity: 0, y: isUp ? 4 : -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring.bouncy}
      className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums ${isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
      {isUp ? <ChevronUp size={13} strokeWidth={2.5} /> : <ChevronDown size={13} strokeWidth={2.5} />}{Math.abs(delta)}
    </motion.span>
  </AnimatePresence>;
}

/** Floating score delta that rises and fades. */
function ScoreDelta({ points, questionId }) {
  if (!points || points <= 0) return null;
  return <AnimatePresence mode="popLayout">
    <motion.span key={`${points}-${questionId}`} initial={{ opacity: 0, y: 0 }} animate={{ opacity: 1, y: -2 }} exit={{ opacity: 0, y: -12 }} transition={SPRING}
      className="block text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">+{points}</motion.span>
  </AnimatePresence>;
}

/** Name/score text that settles into place when its row becomes the special rank. */
function Reveal({ active, reducedMotion, delay = 0, className, children }) {
  return <motion.span key={active ? 'featured' : 'plain'} className={className}
    initial={active && !reducedMotion ? { opacity: 0, y: 8, filter: 'blur(6px)' } : false}
    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ ...SPRING, delay }}>{children}</motion.span>;
}

/** The sash body carries the shine sweeps; sparks only play during the intro. */
function Sash({ reducedMotion }) {
  return <>
    <span className="ranking-sash-body" aria-hidden="true" />
    {!reducedMotion && SPARKS.map((style, index) => <span key={index} className="ranking-sash-spark" style={style} aria-hidden="true" />)}
  </>;
}

function PresenterRow({ entry, rank, orderIndex = 0, isFeatured, isDimmed, reducedMotion }) {
  const podium = rank < 3;
  const delay = useEntryDelay(orderIndex);
  const medal = podium && !isFeatured;
  return <motion.div layout={reducedMotion ? false : 'position'} data-ranking-featured={isFeatured ? 'true' : undefined} data-rank={rank + 1} data-podium={podium ? 'true' : 'false'}
    data-medal={medal ? rank + 1 : undefined} style={medal ? { '--medal-i': rank } : undefined}
    className={`board-ranking-row ${isFeatured ? 'ranking-sash' : medal ? `medal-row${reducedMotion ? ' medal-static' : ''}` : ''}`} initial={reducedMotion ? false : { opacity: 0, y: 6 }}
    animate={{ opacity: isDimmed ? dim.spotlight : 1, y: 0, scale: isFeatured && !reducedMotion ? 1.02 : 1 }} transition={{ ...SPRING, delay, layout: settle }}>
    {isFeatured && <Sash reducedMotion={reducedMotion} />}
    <span className={`board-ranking-rank ${isFeatured ? 'ranking-sash-emblem' : medal ? 'medal-emblem' : ''}`} aria-label={`${rank + 1}위${isFeatured ? ' 특별 순위' : ''}`}>{rank + 1}</span>
    <div className="board-ranking-name">
      <Reveal active={isFeatured} reducedMotion={reducedMotion} delay={0.12}>{entry.nickname || '참여자'}</Reveal>
    </div>
    <Reveal active={isFeatured} reducedMotion={reducedMotion} delay={0.2} className="board-ranking-score">
      <AnimatedScore value={Number(entry.total) || 0} suffix="" /><small>점</small>
    </Reveal>
  </motion.div>;
}

const BADGE = 'shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-tight';

/** Single leaderboard row. Presenter rows use the board stylesheet; phones use the compact card. */
export default function LeaderboardRow({ entry, rank, isHighlighted = false, rankDelta = 0, presenter = false, orderIndex = 0, reducedMotion = false, isFeatured = false, isDimmed = false }) {
  const phoneDelay = useEntryDelay(orderIndex);
  if (presenter) return <PresenterRow entry={entry} rank={rank} orderIndex={orderIndex} isFeatured={isFeatured} isDimmed={isDimmed} reducedMotion={reducedMotion} />;
  const podium = rank < 3;
  const medal = podium && !isFeatured;
  const surface = isFeatured ? 'ranking-sash text-white'
    : isHighlighted ? 'bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-500'
    : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700';
  const streak = entry.streak || 0;
  const showMeta = rankDelta !== 0 || streak > 1;
  const text = isFeatured ? 'text-white' : 'text-slate-900 dark:text-slate-100';
  return <motion.div layout={reducedMotion ? false : 'position'} initial={reducedMotion ? false : { opacity: 0, y: 4 }} animate={{ opacity: isDimmed ? 0.6 : 1, y: 0, scale: isFeatured && !reducedMotion ? 1.02 : 1 }}
    transition={{ ...SPRING, delay: phoneDelay, layout: settle }}
    data-ranking-featured={isFeatured ? 'true' : undefined} data-rank={rank + 1}
    data-medal={medal ? rank + 1 : undefined} style={medal ? { '--medal-i': rank } : undefined}
    className={`${medal ? `medal-row${reducedMotion ? ' medal-static' : ''} ` : ''}relative flex items-center gap-3 min-h-14 rounded-xl border px-3 py-2 transition-colors ${reducedMotion ? 'duration-0' : 'duration-200'} ${surface}`}>
    {isFeatured && <Sash reducedMotion={reducedMotion} />}
    <span aria-label={`${rank + 1}위${isFeatured ? ' 특별 순위' : ''}`} className={`shrink-0 text-center text-sm tabular-nums ${isFeatured ? 'w-6 ranking-sash-emblem' : medal ? 'medal-emblem flex h-8 w-8 items-center justify-center rounded-full font-bold' : 'w-6 font-semibold text-slate-400 dark:text-slate-500'}`}>
      {rank + 1}
    </span>
    <Avatar name={entry.nickname} size="sm" />
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1.5">
        <span className={`truncate text-sm ${podium || isFeatured ? 'font-semibold' : 'font-medium'} ${text}`}>{entry.nickname || '참여자'}</span>
        {isHighlighted && <span className={`${BADGE} ${isFeatured ? 'bg-white text-indigo-800' : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'}`}>나</span>}
      </div>
      {showMeta && <div className={`mt-0.5 flex items-center gap-2 text-xs ${isFeatured ? 'text-indigo-100' : 'text-slate-400'}`}>
        {rankDelta !== 0 && <RankChange delta={rankDelta} />}
        {streak > 1 && <span className={`inline-flex items-center gap-0.5 font-medium ${streak >= 3 && !isFeatured ? 'text-amber-600 dark:text-amber-400' : ''}`}><Flame size={13} />{streak}연속</span>}
      </div>}
    </div>
    <div className="shrink-0 text-right">
      <span className={`block text-sm font-bold tabular-nums ${text}`}><AnimatedScore value={Number(entry.total) || 0} /></span>
      <ScoreDelta points={entry.lastPoints} questionId={entry.lastQuestionId} />
    </div>
  </motion.div>;
}
