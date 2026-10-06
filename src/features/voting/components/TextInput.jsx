import { useVoteAcknowledgement } from '@/hooks/useVoteAcknowledgement';
import { useAIAvailability } from '@/hooks/useAIAvailability';
import { ref, set, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { getParticipantId, getNickname } from '@/lib/participant';
import { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { spring } from '@/lib/motion';
import { Send, MessageCircle, Cloud, PenLine } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useMyVote } from '@/hooks/useMyVote';

function SubmitConfirm({ type, value }) {
  const { available } = useAIAvailability();
  const isQnA = type === 'qna';
  const isSubjective = type === 'subjective';
  const isGuess = type === 'mysteryBox' || type === 'hintQuiz';
  const Icon = isSubjective ? PenLine : isQnA ? MessageCircle : Cloud;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.default}
      className="w-full rounded-xl bg-white dark:bg-slate-800 px-5 py-8 shadow-sm"
    >
      <div className="flex flex-col items-center gap-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ ...spring.default, delay: 0.15 }}
        >
          <div className="w-14 h-14 bg-slate-900 rounded-full flex items-center justify-center">
            <Icon size={24} className="text-white" />
          </div>
        </motion.div>

        <div className="space-y-1 text-center">
          <p className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {isGuess ? '답변이 제출되었습니다' : isSubjective ? '답변이 제출되었습니다' : isQnA ? '질문이 전달되었습니다' : '단어가 등록되었습니다'}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isGuess
              ? '정답 공개를 기다려주세요'
              : isSubjective
                ? available ? 'AI 채점 결과를 기다려주세요' : '제출한 답변은 아래에서 확인할 수 있어요.'
                : isQnA
                  ? '강사가 확인할 예정입니다'
                  : '워드클라우드에 반영되었습니다'}
          </p>
        </div>

        {value && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-700 dark:border-slate-600 px-4 py-3 text-center w-full"
          >
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">내가 {isGuess ? '입력한 답' : isSubjective ? '쓴 답변' : isQnA ? '보낸 질문' : '입력한 단어'}</p>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{value}</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export default memo(function TextInput({ sessionId, questionId, type = 'wordcloud', placeholder, maxLength = 50, disabled = false, multiline = false }) {
  const { myVote } = useMyVote(sessionId, questionId);
  const { begin, finish, canRestore, isCurrent } = useVoteAcknowledgement(`${sessionId}:${questionId}`);
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedValue, setSubmittedValue] = useState('');
  const [error, setError] = useState(null);

  // 새로고침/재마운트 시 이미 제출한 답 복원 — 없으면 빈 입력창이 다시 떠서 중복 제출(덮어쓰기) 가능
  useEffect(() => {
    if (canRestore() && myVote && !submitted) { setSubmittedValue(myVote); setSubmitted(true); }
  }, [myVote, submitted, canRestore]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim() || disabled || submitting) return;
    const token = begin(); if (token === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const pid = getParticipantId();
      await set(ref(db, `sessions/${sessionId}/questions/${questionId}/votes/${pid}`), {
        value: text.trim(),
        nickname: getNickname() || '익명',
        timestamp: serverTimestamp(),
      });
      if (!finish(token)) return;
      setSubmittedValue(text.trim());
      setSubmitted(true);
    } catch (err) {
      if (!finish(token)) return;
      setSubmitted(false);
      setSubmittedValue('');
      logger.error('Submit failed:', err);
      setError('제출에 실패했습니다. 다시 시도해주세요.');
    } finally { if (isCurrent(token)) setSubmitting(false); }
  }

  if (submitted) return <SubmitConfirm type={type} value={submittedValue} />;

  return (
    <motion.form
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.default}
      onSubmit={handleSubmit}
      className="w-full space-y-3"
    >
      <div className="relative">
        {multiline ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder || '입력해주세요'}
            aria-label="답변 입력"
            maxLength={maxLength}
            rows={5}
            className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 dark:placeholder:text-slate-300 rounded-xl px-4 py-3.5 pb-7 text-base placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-600 transition-colors duration-150 resize-none leading-relaxed"
            autoFocus
          />
        ) : (
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder || '입력해주세요'}
            aria-label={type === 'qna' ? '질문 입력' : '단어 입력'}
            maxLength={maxLength}
            enterKeyHint="send"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSubmit(e); }}
            className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 dark:placeholder:text-slate-300 rounded-xl px-4 py-3.5 pr-16 text-base placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-600 transition-colors duration-150"
            autoFocus
          />
        )}
        <span className={`absolute right-4 text-xs text-slate-300 dark:text-slate-500 font-medium ${multiline ? 'bottom-3' : 'top-1/2 -translate-y-1/2'}`}>
          {text.length}/{maxLength}
        </span>
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            role="alert"
            className="text-red-500 text-sm text-center font-medium"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={!text.trim() || disabled || submitting}
        className="w-full"
      >
        <Send size={18} />
        제출하기
      </Button>
    </motion.form>
  );
})
