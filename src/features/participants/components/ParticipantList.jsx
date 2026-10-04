import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';

const INITIAL_SHOW = 20;

export default memo(function ParticipantList({ participants, voteCounts }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? participants : participants.slice(0, INITIAL_SHOW);
  const remaining = participants.length - INITIAL_SHOW;

  return (
    <div className="space-y-0.5 max-h-64 overflow-y-auto scrollbar-hide">
      <AnimatePresence initial={false}>
        {visible.map((p) => {
          const voteCount = voteCounts?.[p.id];
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300 py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-150"
            >
              <Avatar name={p.nickname} size="sm" />
              {/* 강사 전용 목록 — 사번 입력 시 닉네임 아래 표시(학생/전자칠판엔 미노출). */}
              <div className="flex-1 min-w-0 leading-tight">
                <span className="truncate block">{p.nickname}</span>
                {p.employeeId && p.employeeId !== p.nickname && (
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">사번 {p.employeeId}</span>
                )}
              </div>
              {voteCount > 0 && (
                <span className="text-xs text-slate-400 font-medium tabular-nums shrink-0">{voteCount}개 참여</span>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
      {!expanded && remaining > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium flex items-center justify-center gap-1 transition-colors duration-150"
        >
          <ChevronDown size={14} />
          {remaining}명 더 보기
        </button>
      )}
      {participants.length === 0 && (
        <div className="flex flex-col items-center text-center py-5 space-y-2">
          <DoranDoranMascot size="xs" mood="waiting" />
          <p className="text-slate-400 text-sm font-medium">아직 참여자가 없습니다</p>
          <p className="text-slate-400 text-xs leading-relaxed">아래 QR코드를 공유하여<br />학생을 초대하세요</p>
        </div>
      )}
    </div>
  );
});
