import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Flame, TrendingUp } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import StudentHeader from './StudentHeader';
import StudentBottomBar from './StudentBottomBar';
import Leaderboard from '@/features/quiz/components/Leaderboard';
import { useScores } from '@/features/quiz/api/useScores';
import { getParticipantId } from '@/lib/participant';

/** Displays the student's own rank summary card at the top. */
function MyRankCard({
  rank,
  entry,
  total
}) {
  if (!entry) return null;

  // 상위 % = 내 순위/전체 (1위·301명 → 상위 1%). 기존 식은 역산이라 1위가 '상위 100%'로 표시되던 버그.
  const pct = Math.max(1, Math.ceil(rank / total * 100));
  return <motion.div initial={{
    opacity: 0,
    y: 12
  }} animate={{
    opacity: 1,
    y: 0
  }} transition={{
    type: 'spring',
    stiffness: 300,
    damping: 25
  }} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5">
      {/* Rank number hero */}
      <div className="text-center mb-4">
        <motion.div initial={{
        scale: 0,
        opacity: 0
      }} animate={{
        scale: 1,
        opacity: 1
      }} transition={{
        type: 'spring',
        stiffness: 400,
        damping: 22,
        delay: 0.15
      }}>
          <span className="text-5xl font-bold text-slate-900 dark:text-slate-100 tabular-nums tracking-tight">{rank}</span>
          <span className="text-lg font-bold tracking-tight text-slate-400 dark:text-slate-500 ml-0.5">위</span>
        </motion.div>
        {total > 1 && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {total}명 중 상위 {pct <= 100 ? pct : 100}%
          </p>}
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <Badge variant="primary">
          <Trophy size={12} className="mr-1" />
          {entry.total}점
        </Badge>

        {(entry.streak || 0) > 1 && <Badge variant={entry.streak >= 3 ? 'primary' : 'neutral'}>
            <Flame size={12} className="mr-1" />
            {entry.streak}연속 정답
          </Badge>}
        {(entry.bestStreak || 0) > 2 && entry.bestStreak > (entry.streak || 0) && <Badge variant="neutral">
            <TrendingUp size={12} className="mr-1" />
            최고 {entry.bestStreak}연속
          </Badge>}
      </div>
    </motion.div>;
}

/** Sticky footer showing own rank when scrolled out of leaderboard view. */
function StickyMyRank({
  rank,
  entry
}) {
  if (!entry || rank <= 0) return null;
  return <AnimatePresence>
      {rank > 8 && <motion.div initial={{
      opacity: 0,
      y: 20
    }} animate={{
      opacity: 1,
      y: 0
    }} exit={{
      opacity: 0,
      y: 20
    }} transition={{
      type: 'spring',
      stiffness: 300,
      damping: 25
    }} className="fixed bottom-[120px] left-1/2 -translate-x-1/2 z-20 w-[calc(100%-2.5rem)] max-w-md">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md px-4 py-3 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300 shrink-0">
              {rank}
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate block">{entry.nickname}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">{entry.total}점</span>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shrink-0">나</span>
          </div>
        </motion.div>}
    </AnimatePresence>;
}
export default function LeaderboardPage({
  sessionId
}) {
  const {
    leaderboard
  } = useScores(sessionId);
  const participantId = getParticipantId();
  const {
    myRank,
    myEntry
  } = useMemo(() => {
    const idx = leaderboard.findIndex(entry => entry.id === participantId);
    return {
      myRank: idx >= 0 ? idx + 1 : 0,
      myEntry: idx >= 0 ? leaderboard[idx] : null
    };
  }, [leaderboard, participantId]);
  return <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 flex flex-col items-center px-5 pb-[calc(10rem+env(safe-area-inset-bottom))] pt-20">
      <StudentHeader sessionId={sessionId} />

      <div className="w-full max-w-md space-y-5">
        <MyRankCard rank={myRank} entry={myEntry} total={leaderboard.length} />

        <Leaderboard entries={leaderboard} maxShow={8} title="현재 리더보드" highlightId={participantId} emptyLabel="아직 점수가 집계되지 않았습니다" />
      </div>

      <StickyMyRank rank={myRank} entry={myEntry} total={leaderboard.length} />
      <StudentBottomBar sessionId={sessionId} />
    </div>;
}
