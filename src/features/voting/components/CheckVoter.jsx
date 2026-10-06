import { useVoteAcknowledgement } from '@/hooks/useVoteAcknowledgement';
import { ref, set, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { getParticipantId, getNickname } from '@/lib/participant';
import { motion, AnimatePresence } from 'framer-motion';
import { spring } from '@/lib/motion';
import { hapticTap } from '@/lib/haptics';
import { useState, useEffect, memo } from 'react';
import { Check } from 'lucide-react';
import { useMyVote } from '@/hooks/useMyVote';
import VoteConfirm from './VoteConfirm';
import VoteErrorToast from './VoteErrorToast';

export default memo(function CheckVoter({ sessionId, questionId, disabled = false }) {
  const { myVote } = useMyVote(sessionId, questionId);
  const { begin, finish, canRestore } = useVoteAcknowledgement(`${sessionId}:${questionId}`);
  const [voted, setVoted] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (canRestore() && myVote && !voted) setVoted(true);
  }, [myVote, voted, canRestore]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  async function handleCheck() {
    if (disabled || voted) return;
    const token = begin(); if (token === null) return;
    hapticTap();
    setError(null);
    try {
      const pid = getParticipantId();
      await set(ref(db, `sessions/${sessionId}/questions/${questionId}/votes/${pid}`), {
        value: 'done',
        nickname: getNickname() || '익명',
        timestamp: serverTimestamp(),
      });
      if (!finish(token)) return;
      setVoted(true);
    } catch (err) {
      if (!finish(token)) return;
      setVoted(false);
      logger.error('Check-in failed:', err);
      setError('체크에 실패했습니다. 다시 탭해주세요.');
    }
  }

  if (voted) {
    return (
      <VoteConfirm
        submittedLabel="완료 체크!"
        submittedDescription="강사에게 완료가 전달되었습니다"
        waitingLabel="다음 안내를 기다리는 중..."
        waitingDescription="강사가 진행하면 표시됩니다"
        selectedAnswer="완료"
      />
    );
  }

  return (
    <div className="space-y-3">
    <AnimatePresence>
      {error && <VoteErrorToast message={error} />}
    </AnimatePresence>
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={spring.default}
      whileTap={{ scale: 0.95 }}
      onClick={handleCheck}
      disabled={disabled}
      className={`w-full py-16 rounded-xl border transition-colors duration-150 flex flex-col items-center gap-3 ${
        disabled
          ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-40 cursor-not-allowed'
          : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 active:bg-slate-200 dark:active:bg-slate-600'
      }`}
      aria-label="실습 완료 체크"
    >
      <div className="w-20 h-20 rounded-full bg-slate-900 dark:bg-slate-100 flex items-center justify-center">
        <Check size={40} className="text-white dark:text-slate-900" strokeWidth={3} />
      </div>
      <span className="text-lg font-bold text-slate-900 dark:text-slate-100">완료했어요</span>
      <span className="text-sm text-slate-600 dark:text-slate-400">탭하여 완료를 알려주세요</span>
    </motion.button>
    </div>
  );
});
