import { ref, set, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { getParticipantId, getNickname } from '@/lib/participant';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback, useEffect, useRef, memo, useMemo } from 'react';
import VoteConfirm from './VoteConfirm';
import VoteErrorToast from './VoteErrorToast';
import { useVotes } from '@/hooks/useVotes';
import { useMyVote } from '@/hooks/useMyVote';
import { Users } from 'lucide-react';

/** Map 0–100 to a slate gradient shade for the thumb/fill. */
function getScaleColor(value) {
  if (value <= 20) return 'bg-slate-300';
  if (value <= 40) return 'bg-slate-400';
  if (value <= 60) return 'bg-slate-500';
  if (value <= 80) return 'bg-slate-700';
  return 'bg-slate-900';
}

function ScaleLiveAverage({ sessionId, questionId, myValue }) {
  const { totalVotes, votes } = useVotes(sessionId, questionId);
  const avg = useMemo(() => {
    const vals = Object.values(votes || {}).map(v => Number(v.value)).filter(v => !isNaN(v));
    return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  }, [votes]);

  if (totalVotes === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, type: 'spring', stiffness: 300, damping: 25 }}
      className="w-full rounded-xl bg-white dark:bg-slate-800 p-4 shadow-sm"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 tracking-tight">실시간 평균</p>
        <div className="flex items-center gap-1 text-slate-400">
          <Users size={12} />
          <span className="text-xs font-medium tabular-nums">{totalVotes}</span>
        </div>
      </div>
      <div className="text-center">
        <span className="text-3xl font-bold text-slate-900 dark:text-slate-100 tabular-nums tracking-tight">{avg}</span>
        <span className="text-sm text-slate-400 ml-1">점</span>
      </div>
      <div className="mt-2 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-slate-400 dark:bg-slate-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${avg}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-slate-400">
        <span>0</span>
        <span>내 응답: {myValue}점</span>
        <span>100</span>
      </div>
    </motion.div>
  );
}

export default memo(function ScaleVoter({ sessionId, questionId, minLabel, maxLabel, disabled = false }) {
  // 강사가 설정한 척도 라벨을 학생에게도 그대로 — 발표자 화면과 일치. 미설정 시 기본값.
  const scaleLabels = useMemo(() => [
    { value: 0, label: minLabel || '전혀' },
    { value: 50, label: '보통' },
    { value: 100, label: maxLabel || '매우' },
  ], [minLabel, maxLabel]);
  const { myVote } = useMyVote(sessionId, questionId);
  const [value, setValue] = useState(50);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const trackRef = useRef(null);

  useEffect(() => {
    if (myVote != null && !submitted) { setValue(Number(myVote)); setSubmitted(true); }
  }, [myVote, submitted]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const handleSubmit = useCallback(async () => {
    if (disabled || submitting) return;
    setSubmitting(true);
    try {
      const pid = getParticipantId();
      await set(ref(db, `sessions/${sessionId}/questions/${questionId}/votes/${pid}`), {
        value: String(value),
        nickname: getNickname() || '익명',
        timestamp: serverTimestamp(),
      });
      setSubmitted(true);
    } catch (err) {
      logger.error('Scale vote failed:', err);
      setSubmitting(false);
      setError('응답 제출에 실패했습니다. 다시 시도해주세요.');
    }
  }, [sessionId, questionId, value, disabled, submitting]);

  if (submitted) {
    return (
      <div className="space-y-3">
        <VoteConfirm
          submittedLabel="응답 완료!"
          submittedDescription="의견이 기록되었습니다"
          waitingLabel="결과를 기다리는 중..."
          waitingDescription="강사가 결과를 공개하면 표시됩니다"
          selectedAnswer={`${value}점`}
          selectedAnswerLabel="내 응답"
        />
        <ScaleLiveAverage sessionId={sessionId} questionId={questionId} myValue={value} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
    <AnimatePresence>
      {error && <VoteErrorToast message={error} />}
    </AnimatePresence>
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="w-full rounded-xl bg-white dark:bg-slate-800 p-5 shadow-sm space-y-5"
    >
      {/* Big centered value display */}
      <div className="text-center">
        <motion.p
          key={value}
          initial={{ scale: 1.15, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          className="text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums"
        >
          {value}
        </motion.p>
        <p className="text-xs text-slate-400 mt-1">0~100 사이에서 선택하세요</p>
      </div>

      {/* Slider */}
      <div className="px-1">
        <div className="relative h-12 flex items-center" ref={trackRef}>
          {/* Track background */}
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${getScaleColor(value)}`}
              initial={{ width: '50%' }}
              animate={{ width: `${value}%` }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            />
          </div>

          {/* Native range input - invisible but provides touch/mouse interaction */}
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            disabled={disabled}
            aria-label="의견 강도 선택"
            className="absolute inset-0 w-full h-12 opacity-0 cursor-pointer touch-none"
            style={{ WebkitAppearance: 'none', margin: 0 }}
          />

          {/* Custom thumb indicator */}
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: `calc(${value}% - 10px)` }}
            initial={false}
            animate={{ left: `calc(${value}% - 10px)` }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <div className={`w-5 h-5 rounded-full ${getScaleColor(value)} ring-2 ring-white shadow-md`} />
          </motion.div>
        </div>

        {/* Scale labels */}
        <div className="flex justify-between mt-2.5">
          {scaleLabels.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => setValue(l.value)}
              className={`min-h-12 min-w-12 px-1 text-sm font-medium transition-colors duration-150 ${
                value === l.value ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500 hover:text-slate-500 dark:hover:text-slate-400'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick preset buttons for common values */}
      <div className="flex gap-1.5">
        {[0, 25, 50, 75, 100].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setValue(v)}
            className={`flex-1 min-h-12 py-2 rounded-lg text-sm font-medium transition-colors duration-150 active:scale-[0.96] ${
              value === v
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'bg-slate-50 text-slate-500 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Submit button */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleSubmit}
        disabled={disabled || submitting}
        className="w-full py-3 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-medium text-base transition-colors duration-150 disabled:opacity-50 active:scale-[0.97]"
      >
        {submitting ? '제출 중...' : '제출하기'}
      </motion.button>
    </motion.div>
    </div>
  );
})
