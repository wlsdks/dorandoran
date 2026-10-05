import { useVoteAcknowledgement } from '@/hooks/useVoteAcknowledgement';
import { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { hapticTap } from '@/lib/haptics';
import { ref, set, serverTimestamp } from 'firebase/database';
import { Lock } from 'lucide-react';
import VoteErrorToast from './VoteErrorToast';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { getNickname, getParticipantId } from '@/lib/participant';
import { QUIZ_DEFAULTS } from '@/lib/quiz';
import { useMyVoteFull } from '@/hooks/useMyVote';
import VoteConfirm from './VoteConfirm';
import BetSelector from './BetSelector';
const OPTION_STYLES = [{
  bg: 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700',
  text: 'text-slate-800 dark:text-slate-200',
  badge: 'bg-slate-800 dark:bg-slate-200 dark:text-slate-900',
  letter: 'A'
}, {
  bg: 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700',
  text: 'text-slate-800 dark:text-slate-200',
  badge: 'bg-slate-700 dark:bg-slate-300 dark:text-slate-900',
  letter: 'B'
}, {
  bg: 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700',
  text: 'text-slate-800 dark:text-slate-200',
  badge: 'bg-slate-600 dark:bg-slate-400 dark:text-slate-900',
  letter: 'C'
}, {
  bg: 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700',
  text: 'text-slate-800 dark:text-slate-200',
  badge: 'bg-slate-500 dark:bg-slate-500',
  letter: 'D'
}, {
  bg: 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700',
  text: 'text-slate-800 dark:text-slate-200',
  badge: 'bg-slate-500 dark:bg-slate-500',
  letter: 'E'
}];
const BET_LABELS = {
  1: '1x 안전',
  2: '2x 자신',
  3: '3x 올인'
};

/**
 * Quiz voting component. Handles vote submission only.
 * Quiz result display is handled by the parent route (VotePage).
 *
 * @param {Object} props
 * @param {string} props.sessionId
 * @param {string} props.questionId
 * @param {Object} props.question
 * @param {function} [props.renderResult] - Render function called with currentVote when quiz is revealed and user voted
 */
export default memo(function QuizVoter({
  sessionId,
  questionId,
  question,
  renderResult,
  disabled = false
}) {
  const participantId = getParticipantId();
  const {
    myVote
  } = useMyVoteFull(sessionId, questionId);
  const { begin, finish, canRestore, isCurrent } = useVoteAcknowledgement(`${sessionId}:${questionId}`);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const currentVote = hasAcknowledged ? myVote : null;
  useEffect(() => {
    if (canRestore() && myVote) setHasAcknowledged(true);
  }, [myVote, canRestore]);
  const [selected, setSelected] = useState(null);
  const [betMultiplier, setBetMultiplier] = useState(1);
  const [error, setError] = useState(null);
  const bettingEnabled = question?.betting === true;
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);
  async function submitVote(option, confidence) {
    const token = begin(); if (token === null) return;
    setPending(true);
    setSelected(option);
    setError(null);
    try {
      const voteData = {
        value: option,
        nickname: getNickname(),
        timestamp: serverTimestamp()
      };
      if (bettingEnabled && betMultiplier) {
        voteData.bet = betMultiplier;
      }
      if (confidence) {
        voteData.confidence = confidence;
      }
      await set(ref(db, `sessions/${sessionId}/questions/${questionId}/votes/${participantId}`), voteData);
      if (finish(token)) setHasAcknowledged(true);
    } catch (err) {
      if (!finish(token)) return;
      setHasAcknowledged(false);
      logger.error('Quiz vote failed:', err);
      setSelected(null);
      setError('답안 제출에 실패했습니다. 다시 선택해주세요.');
    } finally { if (isCurrent(token)) setPending(false); }
  }
  function handleVote(option) {
    if (disabled || selected !== null) return;
    // 확신도(베팅) 단계 제거 — 선택 즉시 제출 (사용자 요청: 팝업 없이 빠른 응답)
    submitVote(option, null);
  }
  if (question?.revealedAt && currentVote) {
    return typeof renderResult === 'function' ? renderResult(currentVote) : null;
  }
  if (currentVote) {
    const votedValue = currentVote.value;
    const optIdx = (question?.options || []).indexOf(votedValue);
    const ansLetter = optIdx >= 0 ? String.fromCharCode(65 + optIdx) : '';
    const betLabel = currentVote.bet ? BET_LABELS[parseInt(currentVote.bet, 10)] : null;
    return <VoteConfirm submittedLabel="답안 제출 완료!" waitingLabel="정답 공개를 기다리는 중..." waitingDescription="강사가 정답과 순위를 공개하면 결과를 확인할 수 있습니다" selectedAnswer={ansLetter ? `${ansLetter}. ${votedValue}` : votedValue} selectedAnswerLabel={betLabel ? `내 답안 (${betLabel})` : '내 답안'} />;
  }
  if (question?.revealedAt) {
    const correctAnswer = question.correctAnswer;
    const options = question?.options || [];
    return <motion.div initial={{
      opacity: 0,
      y: 12
    }} animate={{
      opacity: 1,
      y: 0
    }} transition={{
      type: 'spring',
      stiffness: 300,
      damping: 25
    }} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <motion.div initial={{
          scale: 0
        }} animate={{
          scale: 1
        }} transition={{
          type: 'spring',
          stiffness: 400,
          damping: 22,
          delay: 0.1
        }} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
            <Lock size={18} className="text-slate-400 dark:text-slate-500" />
          </motion.div>
          <div>
            <p className="text-slate-900 dark:text-slate-100 font-bold text-base">정답이 공개되었습니다</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm">이번 라운드에 참여하지 않았습니다</p>
          </div>
        </div>

        {/* Options with correct highlight */}
        {options.length > 0 && <div className="space-y-2">
            {options.map((option, index) => {
          const style = OPTION_STYLES[index % OPTION_STYLES.length];
          const letter = String.fromCharCode(65 + index);
          const isCorrect = option === correctAnswer;
          return <motion.div key={option} initial={{
            opacity: 0,
            x: -8
          }} animate={{
            opacity: isCorrect ? 1 : 0.45,
            x: 0
          }} transition={{
            type: 'spring',
            stiffness: 300,
            damping: 25,
            delay: 0.12 + index * 0.05
          }} className={`w-full py-3 px-4 rounded-xl border flex items-center gap-3 ${isCorrect ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${isCorrect ? 'bg-white/20 dark:bg-slate-900/20 text-white dark:text-slate-900' : `${style.badge} text-white`}`}>
                    {letter}
                  </span>
                  <span className={`text-sm font-medium leading-snug ${isCorrect ? 'text-white dark:text-slate-900' : 'text-slate-600 dark:text-slate-400'}`}>
                    {option}
                  </span>
                </motion.div>;
        })}
          </div>}

        {/* Fallback for non-choice types */}
        {options.length === 0 && correctAnswer && <motion.div initial={{
        opacity: 0,
        y: 6
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        type: 'spring',
        stiffness: 300,
        damping: 25,
        delay: 0.2
      }} className="rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-4 py-3 text-center">
            <p className="text-xs font-medium text-slate-400 mb-0.5">정답</p>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{correctAnswer}</p>
          </motion.div>}
      </motion.div>;
  }
  return <div className="space-y-4 w-full">
      {pending && <p role="status" className="text-center text-sm text-slate-500 dark:text-slate-300">답안을 보내는 중...</p>}
      <AnimatePresence>
        {error && <VoteErrorToast message={error} />}
      </AnimatePresence>
      {bettingEnabled && <BetSelector value={betMultiplier} onSelect={setBetMultiplier} disabled={disabled || selected !== null || pending} />}
      <motion.div key="options" initial={{
        opacity: 0,
        y: 12
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        type: 'spring',
        stiffness: 300,
        damping: 25
      }} className="space-y-4">
            <p className="text-xs text-slate-400 text-center">
              {bettingEnabled ? '배율은 답을 고르기 전까지 바꿀 수 있어요. 답을 고르면 바로 제출됩니다.' : question?.event ? '이벤트 라운드 — 보너스 점수가 적용됩니다' : (question?.maxSpeedBonus ?? QUIZ_DEFAULTS.maxSpeedBonus) > 0 ? '빠르게 답할수록 더 높은 점수를 받을 수 있습니다' : '답을 고르면 바로 제출됩니다.'}
            </p>

            <div className="space-y-2.5">
              {(question?.options || []).map((option, index) => {
            const style = OPTION_STYLES[index % OPTION_STYLES.length];
            const letter = String.fromCharCode(65 + index);
            const isSelected = selected === option;
            const isLocked = selected !== null;
            return <motion.button key={option} initial={{
              opacity: 0,
              y: 12
            }} animate={{
              opacity: isLocked && !isSelected ? 0.3 : 1,
              y: 0,
              scale: isSelected ? 0.98 : 1
            }} transition={{
              delay: index * 0.05,
              type: 'spring',
              stiffness: 300,
              damping: 25
            }} whileTap={{
              scale: 0.97
            }} onClick={() => {
              hapticTap();
              handleVote(option);
            }} disabled={isLocked || disabled} className={`w-full min-h-[56px] py-3.5 px-4 rounded-xl border font-medium text-base ${style.bg} ${style.text} ${isSelected ? 'ring-2 ring-slate-400 dark:ring-slate-500 border-slate-300 dark:border-slate-500 bg-slate-50 dark:bg-slate-700' : 'border-slate-200 dark:border-slate-700'} ${isLocked && !isSelected ? 'pointer-events-none' : ''} ${disabled ? 'pointer-events-none' : ''} transition-colors duration-150 flex items-center gap-3`}>
                    <span className={`w-8 h-8 rounded-lg ${style.badge} flex items-center justify-center text-sm font-bold shrink-0 text-white`}>
                      {letter}
                    </span>
                    <span className="text-left leading-snug">{option}</span>
                  </motion.button>;
          })}
            </div>

          </motion.div>
    </div>;
});
