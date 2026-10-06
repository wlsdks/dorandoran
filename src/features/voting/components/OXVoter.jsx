import { useVoteAcknowledgement } from '@/hooks/useVoteAcknowledgement';
import { RotateCcw } from 'lucide-react';
import { ref, set, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { getParticipantId, getNickname } from '@/lib/participant';
import { motion, AnimatePresence } from 'framer-motion';
import { spring } from '@/lib/motion';
import { hapticTap } from '@/lib/haptics';
import { useState, useEffect, memo } from 'react';
import { useMyVote } from '@/hooks/useMyVote';
import VoteConfirm from './VoteConfirm';
import StudentLiveResults from './StudentLiveResults';
import VoteErrorToast from './VoteErrorToast';

export default memo(function OXVoter({ sessionId, questionId, disabled = false }) {
  const { myVote } = useMyVote(sessionId, questionId);
  const { begin, finish, canRestore, isCurrent } = useVoteAcknowledgement(`${sessionId}:${questionId}`);
  const [voted, setVoted] = useState(false);
  const [changing, setChanging] = useState(false); // 답 바꾸기 중 복원 차단
  const [selected, setSelected] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (canRestore() && ['O', 'X'].includes(myVote) && !voted && !changing) { setSelected(myVote); setVoted(true); }
  }, [myVote, voted, changing, canRestore]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  async function handleVote(value) {
    if (disabled) return;
    const token = begin(); if (token === null) return;
    setPending(true);
    setSelected(value);
    setError(null);
    try {
      const pid = getParticipantId();
      await set(ref(db, `sessions/${sessionId}/questions/${questionId}/votes/${pid}`), {
        value,
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
    } finally { if (isCurrent(token)) setPending(false); }
  }

  if (voted) {
    return (
      <div className="space-y-3">
        <VoteConfirm selectedAnswer={selected === 'O' ? 'O (맞아요)' : 'X (아니에요)'} />
        {/* 정답 공개/마감 전(!disabled)엔 답 변경 허용 — 실수 정정. 재선택 시 덮어씀. */}
        {!disabled && (
          <button
            onClick={() => { setChanging(true); setVoted(false); setSelected(null); }}
            className="w-full flex items-center justify-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 ring-1 ring-slate-200/70 dark:ring-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700 min-h-12 rounded-xl py-2.5 transition-colors duration-150 active:scale-[0.98]"
          >
            <RotateCcw size={15} />
            답 바꾸기
          </button>
        )}
        <StudentLiveResults
          sessionId={sessionId}
          questionId={questionId}
          options={['O', 'X']}
          myAnswer={selected}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 w-full">
      {pending && <p role="status" className="text-center text-sm text-slate-500 dark:text-slate-300">응답을 보내는 중...</p>}
      <AnimatePresence>
        {error && <VoteErrorToast message={error} />}
      </AnimatePresence>
    <div className="flex gap-3.5 w-full" role="group" aria-label="O/X 선택">
      <motion.button
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={spring.default}
        whileTap={{ scale: 0.95 }}
        onClick={() => { hapticTap(); handleVote('O'); }}
        disabled={selected !== null || disabled}
        className={`flex-1 min-h-[140px] py-10 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border transition-colors duration-150 flex flex-col items-center justify-center gap-2 ${selected === 'O' ? 'ring-2 ring-slate-400 dark:ring-slate-500 border-slate-300 dark:border-slate-500' : 'border-slate-200 dark:border-slate-700'} ${(selected !== null && selected !== 'O') || disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
      >
        <span className="text-6xl font-black text-slate-900 dark:text-slate-100 leading-none">O</span>
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">맞아요</span>
      </motion.button>
      <motion.button
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={spring.default}
        whileTap={{ scale: 0.95 }}
        onClick={() => { hapticTap(); handleVote('X'); }}
        disabled={selected !== null || disabled}
        className={`flex-1 min-h-[140px] py-10 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border transition-colors duration-150 flex flex-col items-center justify-center gap-2 ${selected === 'X' ? 'ring-2 ring-slate-400 dark:ring-slate-500 border-slate-300 dark:border-slate-500' : 'border-slate-200 dark:border-slate-700'} ${(selected !== null && selected !== 'X') || disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
      >
        <span className="text-6xl font-black text-slate-900 dark:text-slate-100 leading-none">X</span>
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">아니에요</span>
      </motion.button>
    </div>
    </div>
  );
})
