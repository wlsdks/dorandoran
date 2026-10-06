import { useVoteAcknowledgement } from '@/hooks/useVoteAcknowledgement';
import { ref, set, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { getParticipantId, getNickname } from '@/lib/participant';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback, useEffect, useMemo, memo } from 'react';
import { useVotes } from '@/hooks/useVotes';
import { useMyVote } from '@/hooks/useMyVote';
import { Users } from 'lucide-react';
import VoteConfirm from './VoteConfirm';
import VoteErrorToast from './VoteErrorToast';

/** Live debate ratio shown after voting. */
function DebateLiveRatio({ sessionId, questionId, mySide }) {
  const { voteList, totalVotes } = useVotes(sessionId, questionId);

  const { forCount, againstCount } = useMemo(() => {
    let f = 0;
    let a = 0;
    voteList.forEach((v) => {
      // vote value stored as "for:의견" or "against:의견"
      if (typeof v.value === 'string') {
        if (v.value.startsWith('for:')) f++;
        else if (v.value.startsWith('against:')) a++;
      }
    });
    return { forCount: f, againstCount: a };
  }, [voteList]);

  const forPct = totalVotes > 0 ? Math.round((forCount / totalVotes) * 100) : 50;
  const againstPct = totalVotes > 0 ? Math.round((againstCount / totalVotes) * 100) : 50;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, type: 'spring', stiffness: 300, damping: 25 }}
      className="w-full rounded-xl bg-white dark:bg-slate-800 p-4 shadow-sm space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 tracking-tight">실시간 결과</p>
        <div className="flex items-center gap-1 text-slate-400">
          <Users size={12} />
          <span className="text-xs font-medium">{totalVotes}</span>
        </div>
      </div>

      {/* Ratio bar */}
      <div className="space-y-2">
        <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
          <motion.div
            animate={{ width: `${forPct}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="bg-slate-800 dark:bg-slate-200 h-full rounded-l-full"
          />
          <motion.div
            animate={{ width: `${againstPct}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="bg-slate-300 dark:bg-slate-600 h-full rounded-r-full"
          />
        </div>
        <div className="flex justify-between text-xs">
          <span className={`font-semibold ${mySide === 'for' ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500'}`}>
            찬성 {forPct}%
            {mySide === 'for' && <span className="text-slate-400 font-normal ml-1">(나)</span>}
          </span>
          <span className={`font-semibold ${mySide === 'against' ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500'}`}>
            반대 {againstPct}%
            {mySide === 'against' && <span className="text-slate-400 font-normal ml-1">(나)</span>}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export default memo(function DebateVoter({ sessionId, questionId, disabled = false }) {
  const { myVote } = useMyVote(sessionId, questionId);
  const { begin, finish, canRestore } = useVoteAcknowledgement(`${sessionId}:${questionId}`);
  const [side, setSide] = useState(null); // 'for' | 'against'
  const [opinion, setOpinion] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 저장 형태는 `${side}:${opinion}`(예: "for:동의함") — side만 추출해 복원해야
    // 새로고침 시 찬/반 라벨·(나) 마커가 올바르게 표시되고 의견 텍스트도 살아난다.
    if (canRestore() && myVote && !submitted) {
      const ci = myVote.indexOf(':');
      setSide(ci >= 0 ? myVote.slice(0, ci) : myVote);
      if (ci >= 0) setOpinion(myVote.slice(ci + 1));
      setSubmitted(true);
    }
  }, [myVote, submitted, canRestore]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const handleSubmit = useCallback(async () => {
    if (disabled || submitting || !side) return;
    const token = begin(); if (token === null) return;
    setSubmitting(true);
    try {
      const pid = getParticipantId();
      // Store as "for:의견내용" or "against:의견내용" for compact Firebase structure
      const value = `${side}:${opinion.trim()}`;
      await set(ref(db, `sessions/${sessionId}/questions/${questionId}/votes/${pid}`), {
        value,
        nickname: getNickname() || '익명',
        timestamp: serverTimestamp(),
      });
      if (!finish(token)) return;
      setSubmitted(true);
    } catch (err) {
      if (!finish(token)) return;
      setSubmitted(false);
      logger.error('Debate vote failed:', err);
      setSubmitting(false);
      setError('제출에 실패했습니다. 다시 시도해주세요.');
    }
  }, [sessionId, questionId, side, opinion, disabled, submitting, begin, finish]);

  if (submitted) {
    return (
      <div className="space-y-3">
        <VoteConfirm
          submittedLabel="의견 제출 완료!"
          submittedDescription="다른 참여자의 의견을 기다려주세요"
          waitingLabel="토론 결과를 기다리는 중..."
          waitingDescription="강사가 결과를 공개하면 표시됩니다"
          selectedAnswer={`${side === 'for' ? '찬성' : '반대'}${opinion.trim() ? ` — "${opinion.trim()}"` : ''}`}
          selectedAnswerLabel="내 의견"
        />
        <DebateLiveRatio sessionId={sessionId} questionId={questionId} mySide={side} />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="w-full space-y-3"
    >
      <AnimatePresence>
        {error && <VoteErrorToast message={error} />}
      </AnimatePresence>

      {/* Side selection */}
      <div className="flex gap-3 w-full" role="group" aria-label="찬성/반대 선택">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setSide('for')}
          disabled={disabled}
          className={`flex-1 py-6 rounded-xl border transition-colors duration-150 flex flex-col items-center gap-1.5 ${
            side === 'for'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 dark:text-slate-300'
          } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          <span className="text-3xl font-black tracking-tight">찬성</span>
          <span className={`text-xs font-medium ${side === 'for' ? 'text-indigo-200 dark:text-indigo-700' : 'text-slate-600 dark:text-slate-300'}`}>동의합니다</span>
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setSide('against')}
          disabled={disabled}
          className={`flex-1 py-6 rounded-xl border transition-colors duration-150 flex flex-col items-center gap-1.5 ${
            side === 'against'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 dark:text-slate-300'
          } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          <span className="text-3xl font-black tracking-tight">반대</span>
          <span className={`text-xs font-medium ${side === 'against' ? 'text-slate-300 dark:text-slate-600' : 'text-slate-600 dark:text-slate-300'}`}>동의하지 않습니다</span>
        </motion.button>
      </div>

      {/* Opinion input + submit — only after choosing a side */}
      <AnimatePresence>
        {side && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="overflow-hidden space-y-3"
          >
            <div className="rounded-xl bg-white dark:bg-slate-800 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">한 줄 의견 <span className="font-normal">(선택)</span></p>
                <span className="text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">{opinion.length}/50</span>
              </div>
              <input
                type="text"
                value={opinion}
                onChange={(e) => setOpinion(e.target.value.slice(0, 50))}
                placeholder="이유를 한 줄로 적어주세요"
                aria-label="한 줄 의견"
                enterKeyHint="done"
                className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-300 rounded-lg px-4 py-3 text-base placeholder:text-slate-600 focus:outline-none focus:bg-white focus:border-slate-400 transition-colors duration-150"
              />
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSubmit}
              disabled={disabled || submitting}
              className="w-full py-3 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-medium text-base transition-colors duration-150 disabled:opacity-50 active:scale-[0.97]"
            >
              {submitting ? '제출 중...' : '제출하기'}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
})
