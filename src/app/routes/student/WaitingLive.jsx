import { memo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import AnimatedNumber from '@/components/ui/AnimatedNumber';
import { useWaitingRoom } from '@/features/participants/api/useParticipants';
import { useMyScore } from '@/features/quiz/api/useScores';
import { getParticipantId } from '@/lib/participant';
import { hapticTap } from '@/lib/haptics';
import { OPEN_RANKING_EVENT } from './StudentHeader';

const SPRING = { type: 'spring', stiffness: 300, damping: 25 };

/**
 * 대기 중 살아 있는 정보 — 실제 접속 인원, 방금 들어온 사람, 내 점수.
 * 가짜 데이터 없음: 점수가 없으면 점수 줄을 그리지 않는다.
 */
export default memo(function WaitingLive({ sessionId }) {
  const reduced = useReducedMotion();
  const { count, recent } = useWaitingRoom(sessionId);
  const { myScore } = useMyScore(sessionId);
  const me = getParticipantId();
  const others = recent.filter(person => person.id !== me).slice(0, 3);
  const total = Number.isFinite(myScore?.total) ? myScore.total : 0;
  const hasScore = total > 0 || Boolean(myScore?.quizAwards);
  if (count <= 0 && !hasScore) return null;
  return (
    <div className="w-full overflow-hidden rounded-2xl bg-white dark:bg-slate-800 shadow-sm ring-1 ring-slate-200/70 dark:ring-slate-700/60 text-left">
      {count > 0 && (
        <div className="px-5 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">지금 함께 있는 사람</p>
            <p className="text-slate-900 dark:text-slate-100 tabular-nums leading-none" aria-live="polite" aria-atomic="true">
              <span className="text-2xl font-bold tracking-tight"><AnimatedNumber value={count} /></span><span className="ml-0.5 text-sm font-medium text-slate-500 dark:text-slate-400">명</span>
            </p>
          </div>
          {others.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="최근 입장">
              <AnimatePresence mode="popLayout" initial={false}>
                {others.map(person => (
                  <motion.li key={person.id} layout={!reduced} initial={reduced ? false : { opacity: 0, scale: 0.85, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={SPRING}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-50 dark:bg-slate-700/60 py-1 pl-1 pr-2.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                    <Avatar name={person.nickname} size="xs" /><span className="truncate">{person.nickname}</span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      )}
      {hasScore && (
        <motion.button type="button" whileTap={{ scale: reduced ? 1 : 0.985 }} onClick={() => { hapticTap(); window.dispatchEvent(new CustomEvent(OPEN_RANKING_EVENT, { detail: { tab: 'ranking' } })); }}
          aria-label={`내 점수 ${total}점, 실시간 랭킹 보기`} aria-haspopup="dialog"
          className={`w-full min-h-14 flex items-center justify-between gap-3 px-5 py-3 text-left active:bg-slate-100 dark:active:bg-slate-700 transition-colors duration-100 ${count > 0 ? 'border-t border-slate-100 dark:border-slate-700' : ''}`}>
          <span><span className="block text-sm font-medium text-slate-500 dark:text-slate-400">내 점수</span><span className="block text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100"><AnimatedNumber value={total} />점</span></span>
          <span className="inline-flex items-center gap-0.5 text-sm font-semibold text-slate-700 dark:text-slate-200">랭킹 보기<ChevronRight size={18} aria-hidden="true" className="text-slate-400" /></span>
        </motion.button>
      )}
    </div>
  );
});
