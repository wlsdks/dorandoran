import { useVoteAcknowledgement } from '@/hooks/useVoteAcknowledgement';
import { ref, set, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { getParticipantId, getNickname } from '@/lib/participant';
import { useState, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send } from 'lucide-react';
import Button from '@/components/ui/Button';
import VoteConfirm from './VoteConfirm';
import VoteErrorToast from './VoteErrorToast';
import { useMyVote } from '@/hooks/useMyVote';

/**
 * 단답식(shortAnswer) 학생 입력 — 질문은 상단 hero가 보여주므로 여기선 답 입력만.
 * 제출 후엔 답변/분포를 숨기고 대기 상태만(정답은 강사가 공개하면 전자칠판에 표시).
 */
export default memo(function ShortAnswerVoter({ sessionId, questionId, disabled = false }) {
  const { myVote } = useMyVote(sessionId, questionId);
  const { begin, finish, canRestore } = useVoteAcknowledgement(`${sessionId}:${questionId}`);
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (canRestore() && myVote && !submitted) { setAnswer(myVote); setSubmitted(true); }
  }, [myVote, submitted, canRestore]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const handleSubmit = useCallback(async () => {
    if (disabled || submitting || !answer.trim()) return;
    const token = begin(); if (token === null) return;
    setSubmitting(true);
    try {
      const pid = getParticipantId();
      await set(ref(db, `sessions/${sessionId}/questions/${questionId}/votes/${pid}`), {
        value: answer.trim(),
        nickname: getNickname() || '익명',
        timestamp: serverTimestamp(),
      });
      if (!finish(token)) return;
      setSubmitted(true);
    } catch (err) {
      if (!finish(token)) return;
      setSubmitted(false);
      logger.error('Short-answer vote failed:', err);
      setSubmitting(false);
      setError('답변 제출에 실패했습니다. 다시 시도해주세요.');
    }
  }, [sessionId, questionId, answer, disabled, submitting, begin, finish]);

  if (submitted) {
    return (
      <VoteConfirm
        submittedLabel="답변 제출 완료!"
        submittedDescription="답변이 기록되었습니다"
        waitingLabel="결과를 기다리는 중..."
        waitingDescription="강사가 정답을 공개하면 표시됩니다"
        selectedAnswer={answer.trim()}
        selectedAnswerLabel="내 답변"
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="w-full space-y-4"
    >
      <AnimatePresence>{error && <VoteErrorToast message={error} />}</AnimatePresence>

      <div className="space-y-3">
        <div className="relative">
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer([...e.target.value].slice(0, 30).join(''))}
            placeholder="답을 입력하세요"
            aria-label="단답 입력"
            enterKeyHint="done"
            disabled={disabled}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSubmit(); }}
            className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 rounded-xl px-4 py-3.5 pr-16 text-base placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-700 transition-colors duration-150"
            autoFocus
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-300 dark:text-slate-500 font-medium tabular-nums">
            {[...answer].length}/30
          </span>
        </div>

        <Button onClick={handleSubmit} variant="primary" size="lg" disabled={!answer.trim() || disabled || submitting} className="w-full">
          <Send size={18} />
          {submitting ? '제출 중...' : '제출하기'}
        </Button>
      </div>
    </motion.div>
  );
});
