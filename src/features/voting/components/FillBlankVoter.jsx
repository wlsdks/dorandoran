import { ref, set, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { getParticipantId, getNickname } from '@/lib/participant';
import { useState, useCallback, useEffect, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send } from 'lucide-react';
import Button from '@/components/ui/Button';
import VoteConfirm from './VoteConfirm';
import VoteErrorToast from './VoteErrorToast';
import { useVotes } from '@/hooks/useVotes';
import { useMyVote } from '@/hooks/useMyVote';
import { normalizeAnswer } from '@/lib/utils';
import { Users } from 'lucide-react';

/** Shows the sentence with the blank filled by the student's answer or a placeholder. */
function SentencePreview({ title, answer }) {
  const parts = (title || '').split('___');
  return (
    <p className="text-base text-slate-700 dark:text-slate-200 [word-break:keep-all] [overflow-wrap:anywhere] leading-relaxed">
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <span className={`inline-block mx-0.5 px-2 py-0.5 rounded-md text-sm font-semibold border-b-2 ${
              answer?.trim()
                ? 'bg-slate-100 text-slate-900 border-slate-400 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-500'
                : 'bg-slate-100 text-slate-600 border-dashed border-slate-400 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-400'
            }`}>
              {answer?.trim() || '빈칸'}
            </span>
          )}
        </span>
      ))}
    </p>
  );
}

/** Live answer distribution shown after voting. */
function AnswerDistribution({ sessionId, questionId, correctAnswer }) {
  const { voteList, totalVotes } = useVotes(sessionId, questionId);

  const { correctCount, topAnswers } = useMemo(() => {
    // 대소문자·띄어쓰기 무시로 그룹화("머신 러닝"="머신러닝"). 표시는 처음 등장한 원문 유지.
    const normCorrect = normalizeAnswer(correctAnswer);
    const freq = {};
    let correct = 0;
    voteList.forEach((v) => {
      const raw = (v.value || '').trim();
      const key = normalizeAnswer(raw);
      if (!key) return;
      if (!freq[key]) freq[key] = { display: raw, count: 0 };
      freq[key].count++;
      if (normCorrect && key === normCorrect) correct++;
    });
    const sorted = Object.values(freq)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(({ display, count }) => ({ answer: display, count }));
    return { correctCount: correct, topAnswers: sorted };
  }, [voteList, correctAnswer]);

  const correctPct = totalVotes > 0 ? Math.round((correctCount / totalVotes) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, type: 'spring', stiffness: 300, damping: 25 }}
      className="w-full rounded-xl bg-white dark:bg-slate-800 p-4 shadow-sm space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 tracking-tight">실시간 응답</p>
        <div className="flex items-center gap-1 text-slate-400">
          <Users size={12} />
          <span className="text-xs font-medium">{totalVotes}</span>
        </div>
      </div>

      {correctAnswer && totalVotes > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">정답률</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">{correctPct}%</span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              animate={{ width: `${correctPct}%` }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="h-full bg-slate-700 dark:bg-slate-300 rounded-full"
            />
          </div>
        </div>
      )}

      {topAnswers.length > 0 && (
        <div className="space-y-1">
          {topAnswers.map((a, i) => (
            <div key={a.answer} className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600 w-3 text-right">{i + 1}</span>
              <span className="flex-1 text-xs text-slate-600 dark:text-slate-300 truncate">{a.answer}</span>
              <span className="text-xs text-slate-400 tabular-nums">{a.count}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default memo(function FillBlankVoter({ sessionId, questionId, title, correctAnswer, disabled = false }) {
  const { myVote } = useMyVote(sessionId, questionId);
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (myVote && !submitted) { setAnswer(myVote); setSubmitted(true); }
  }, [myVote, submitted]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const handleSubmit = useCallback(async () => {
    if (disabled || submitting || !answer.trim()) return;
    setSubmitting(true);
    try {
      const pid = getParticipantId();
      await set(ref(db, `sessions/${sessionId}/questions/${questionId}/votes/${pid}`), {
        value: answer.trim(),
        nickname: getNickname() || '익명',
        timestamp: serverTimestamp(),
      });
      setSubmitted(true);
    } catch (err) {
      logger.error('Fill-in-blank vote failed:', err);
      setSubmitting(false);
      setError('답변 제출에 실패했습니다. 다시 시도해주세요.');
    }
  }, [sessionId, questionId, answer, disabled, submitting]);

  if (submitted) {
    return (
      <div className="space-y-3">
        <VoteConfirm
          submittedLabel="답변 제출 완료!"
          submittedDescription="빈칸 채우기 응답이 기록되었습니다"
          waitingLabel="결과를 기다리는 중..."
          waitingDescription="강사가 정답을 공개하면 표시됩니다"
          selectedAnswer={answer.trim()}
          selectedAnswerLabel="내 답변"
        />
        <AnswerDistribution sessionId={sessionId} questionId={questionId} correctAnswer={correctAnswer} />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="w-full space-y-4"
    >
      <AnimatePresence>
        {error && <VoteErrorToast message={error} />}
      </AnimatePresence>

      {/* Sentence with blank */}
      <div className="rounded-xl bg-white dark:bg-slate-800 p-4 shadow-sm">
        <SentencePreview title={title} answer={answer} />
      </div>

      {/* Answer input */}
      <div className="space-y-3">
        <div className="relative">
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer([...e.target.value].slice(0, 30).join(''))}
            placeholder="빈칸에 들어갈 답을 입력하세요"
            aria-label="빈칸 답변"
            enterKeyHint="done"
            disabled={disabled}
            className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 rounded-xl px-4 py-3.5 pr-16 text-base placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-700 transition-colors duration-150"
            autoFocus
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-300 dark:text-slate-500 font-medium tabular-nums">
            {[...answer].length}/30
          </span>
        </div>

        <Button
          onClick={handleSubmit}
          variant="primary"
          size="lg"
          disabled={!answer.trim() || disabled || submitting}
          className="w-full"
        >
          <Send size={18} />
          {submitting ? '제출 중...' : '제출하기'}
        </Button>
      </div>
    </motion.div>
  );
})
