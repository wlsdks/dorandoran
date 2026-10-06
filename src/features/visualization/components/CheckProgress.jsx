import { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { useVotes } from '@/hooks/useVotes';
import { useParticipants } from '@/features/participants/api/useParticipants';
import AnimatedNumber from '@/components/ui/AnimatedNumber';
import { grow, popIn, stagger } from '@/lib/motion';

const MAX_AVATARS = 40; // 완료 아바타 렌더 상한 — 300명 동시 완료 시 렌더 렉 방지

export default memo(function CheckProgress({ sessionId, questionId, presenter = false }) {
  const { totalVotes, voteList } = useVotes(sessionId, questionId);
  const { participants, count } = useParticipants(sessionId);

  const totalParticipants = count || 1;
  const maxDisplayed = presenter ? 6 : MAX_AVATARS;
  const pct = Math.min(100, Math.round((totalVotes / totalParticipants) * 100));

  // Merge nickname from participants, sort by timestamp (most recent first)
  const completedList = useMemo(
    () => [...voteList]
      .map((v) => ({ ...v, nickname: participants[v.id]?.nickname || v.nickname || v.id.slice(0, 6) }))
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)),
    [voteList, participants]
  );

  return (
    <div className={`w-full max-w-2xl mx-auto space-y-8 ${presenter ? 'check-progress-stage' : ''}`}>
      {/* Big progress number */}
      <div className="text-center space-y-4">
        <div className="flex items-baseline justify-center gap-1">
          <span
            className="text-7xl font-black tabular-nums text-slate-900 dark:text-slate-100"
          >
            <AnimatedNumber value={totalVotes} />
          </span>
          <span className="text-3xl font-bold text-slate-300 dark:text-slate-600">
            / {totalParticipants}
          </span>
        </div>
        <p className="text-slate-400 dark:text-slate-500 text-lg font-medium">
          완료한 학생
        </p>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full w-full origin-left bg-slate-900 dark:bg-slate-100 rounded-full"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: pct / 100 }}
            transition={grow}
          />
        </div>
        <div className="flex justify-between text-sm text-slate-400 dark:text-slate-500 tabular-nums">
          <span>{pct}% 완료</span>
          <span>{Math.max(0, totalParticipants - totalVotes)}명 남음</span>
        </div>
      </div>

      {/* Completed avatars list */}
      {completedList.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            {presenter ? '최근 완료한 학습자' : `완료 (${totalVotes}명)`}
          </p>
          <div className="check-completed-list flex flex-wrap gap-2">
            {/* 최근 완료 N명만 렌더 — 300명 동시 완료 시 전원 spring으로 인한 렉 방지 */}
            <AnimatePresence>
              {completedList.slice(0, maxDisplayed).map((v, i) => (
                <motion.div
                  key={v.id}
                  layout="position"
                  initial={popIn.initial}
                  animate={popIn.animate}
                  exit={popIn.exit}
                  transition={{ ...popIn.transition, delay: stagger(i, { cap: 12 }) }}
                  className="inline-flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full pl-1.5 pr-3 py-1"
                >
                  <div className="w-5 h-5 rounded-full bg-slate-900 dark:bg-slate-100 flex items-center justify-center">
                    <Check size={10} className="text-white dark:text-slate-900" strokeWidth={3} />
                  </div>
                  <span className={`text-xs font-medium text-slate-600 dark:text-slate-300 ${presenter ? 'break-words' : 'truncate max-w-[80px]'}`}>
                    {v.nickname}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
            {completedList.length > maxDisplayed && (
              <span className="inline-flex items-center px-3 py-1 text-xs font-medium text-slate-400 dark:text-slate-500">
                외 {completedList.length - maxDisplayed}명
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
