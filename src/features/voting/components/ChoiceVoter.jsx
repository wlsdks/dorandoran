import { useVoteAcknowledgement } from '@/hooks/useVoteAcknowledgement';
import { ref, set, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { getParticipantId, getNickname } from '@/lib/participant';
import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { useState, useEffect, memo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { hapticTap } from '@/lib/haptics';
import { useMyVote } from '@/hooks/useMyVote';
import VoteConfirm from './VoteConfirm';
import StudentLiveResults from './StudentLiveResults';
import VoteErrorToast from './VoteErrorToast';

// 보기 배지는 한 가지 색으로 통일한다 — 순서마다 진하기가 달라지면 의미 없는 위계가 생긴다.
const OPTION_STYLES = [
  { bg: 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700', text: 'text-slate-800 dark:text-slate-200', badge: 'bg-slate-700 dark:bg-slate-300 dark:text-slate-900', letter: 'A' },
  { bg: 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700', text: 'text-slate-800 dark:text-slate-200', badge: 'bg-slate-700 dark:bg-slate-300 dark:text-slate-900', letter: 'B' },
  { bg: 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700', text: 'text-slate-800 dark:text-slate-200', badge: 'bg-slate-700 dark:bg-slate-300 dark:text-slate-900', letter: 'C' },
  { bg: 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700', text: 'text-slate-800 dark:text-slate-200', badge: 'bg-slate-700 dark:bg-slate-300 dark:text-slate-900', letter: 'D' },
  { bg: 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700', text: 'text-slate-800 dark:text-slate-200', badge: 'bg-slate-700 dark:bg-slate-300 dark:text-slate-900', letter: 'E' },
];

export default memo(function ChoiceVoter({ sessionId, questionId, options, disabled = false }) {
  const { myVote } = useMyVote(sessionId, questionId);
  const { begin, finish, canRestore, isCurrent } = useVoteAcknowledgement(`${sessionId}:${questionId}`);
  const [voted, setVoted] = useState(false);
  const [changing, setChanging] = useState(false); // 답 바꾸기 중 — 복원 effect가 즉시 voted로 되돌리는 것 차단
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Restore vote state from Firebase (handles refresh/re-activation)
  useEffect(() => {
    if (canRestore() && myVote && !voted && !changing) {
      setSelected(myVote);
      setVoted(true);
    }
  }, [myVote, voted, changing, canRestore]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  async function handleVote(option) {
    if (disabled) return;
    const token = begin(); if (token === null) return;
    setSelected(option);
    setSubmitting(true);
    setError(null);
    try {
      const pid = getParticipantId();
      await set(ref(db, `sessions/${sessionId}/questions/${questionId}/votes/${pid}`), {
        value: option,
        nickname: getNickname() || '익명',
        timestamp: serverTimestamp(),
      });
      if (!finish(token)) return;
      setVoted(true);
      setChanging(false);
    } catch (err) {
      if (!finish(token)) return;
      setVoted(false);
      logger.error('Vote failed:', err);
      setSelected(null);
      setError('투표에 실패했습니다. 다시 선택해주세요.');
    } finally {
      if (isCurrent(token)) setSubmitting(false);
    }
  }

  if (voted) {
    const idx = options.indexOf(selected);
    const letter = idx >= 0 ? String.fromCharCode(65 + idx) : '';
    return (
      <div className="space-y-3">
        <VoteConfirm selectedAnswer={letter ? `${letter}. ${selected}` : selected} />
        {/* 정답 공개/마감 전(!disabled)엔 답 변경 허용 — 실수 정정. 재선택 시 덮어씀. */}
        {!disabled && (
          <button
            onClick={() => { setChanging(true); setVoted(false); setSelected(null); }}
            className="w-full flex items-center justify-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 ring-1 ring-slate-200/70 dark:ring-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl py-2.5 transition-colors duration-150 active:scale-[0.98]"
          >
            <RotateCcw size={15} />
            답 바꾸기
          </button>
        )}
        <StudentLiveResults
          sessionId={sessionId}
          questionId={questionId}
          options={options}
          myAnswer={selected}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 w-full" role="group" aria-label="선택지">
      <AnimatePresence>
        {error && <VoteErrorToast message={error} />}
      </AnimatePresence>
      {options.map((option, i) => {
        const style = OPTION_STYLES[i % OPTION_STYLES.length];
        const letter = String.fromCharCode(65 + i); // A, B, ..., Z+
        const isSelected = selected === option;
        const hasSelection = selected !== null;
        return (
          <motion.button
            key={option}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{
              opacity: hasSelection && !isSelected ? 0.3 : 1,
              y: hasSelection && !isSelected ? 2 : 0,
              scale: isSelected ? [0.95, 1.04, 1] : 1,
            }}
            transition={isSelected
              ? { scale: { type: 'spring', stiffness: 300, damping: 25 }, opacity: { duration: 0.2 } }
              : { delay: hasSelection ? 0 : i * 0.05, type: 'spring', stiffness: 300, damping: 25, opacity: { duration: 0.15 } }
            }
            whileTap={!hasSelection ? { scale: 0.95 } : undefined}
            onClick={() => { hapticTap(); handleVote(option); }}
            disabled={hasSelection || disabled}
            className={`w-full min-h-[56px] py-4 px-5 rounded-xl border font-medium text-base ${style.bg} ${style.text} ${isSelected ? 'ring-2 ring-slate-400 dark:ring-slate-500 border-slate-300 dark:border-slate-500 bg-slate-50 dark:bg-slate-700' : 'border-slate-200 dark:border-slate-700'} ${hasSelection && !isSelected ? 'pointer-events-none' : ''} transition-colors duration-150 flex items-center gap-3.5`}
          >
            <span className={`w-9 h-9 rounded-lg ${style.badge} text-white flex items-center justify-center text-sm font-bold shrink-0`}>
              {letter}
            </span>
            <span className="text-left leading-snug flex-1">{option}</span>
            {isSelected && submitting && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-slate-600 dark:text-slate-400 shrink-0"
              >
                전송 중...
              </motion.span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
})
