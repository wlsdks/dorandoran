import { useVoteAcknowledgement } from '@/hooks/useVoteAcknowledgement';
import { useRealtimeValue } from '@/hooks/useRealtimeValue';
import { useState, useEffect, useRef, memo } from 'react';
import { ref, set, onValue, remove, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { getParticipantId } from '@/lib/participant';
import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import Button from '@/components/ui/Button';
import { hapticTap } from '@/lib/haptics';

const RATINGS = [1, 2, 3, 4, 5];
const RATING_LABELS = ['매우 아쉬움', '아쉬움', '보통', '좋음', '매우 좋음'];

/** Student voting UI — tap 1~5 */
function StudentSurvey({ sessionId, embedded = false }) {
  const [voted, setVoted] = useState(null);
  const pid = getParticipantId();
  const { begin, finish, canRestore, isCurrent, reset } = useVoteAcknowledgement(`${sessionId}:quickSurvey:${pid}`);
  const { value: savedVote, loading: voteLoading, error: voteLoadError } = useRealtimeValue(sessionId && pid ? `sessions/${sessionId}/quickSurvey/${pid}` : null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const sawSavedVote = useRef(false);
  useEffect(() => {
    if (voteLoading || voteLoadError) return;
    if (savedVote !== null) {
      sawSavedVote.current = true;
      if (canRestore() && RATINGS.includes(savedVote?.rating)) setVoted(savedVote.rating);
    } else if (sawSavedVote.current && voted !== null && !pending && reset()) {
      // 저장 확인을 마친 응답이 서버에서 지워진 때만 새 라운드를 연다. 전송 중 rollback은 제외한다.
      sawSavedVote.current = false;
      setVoted(null);
    }
  }, [savedVote, voteLoading, voteLoadError, voted, pending, canRestore, reset]);

  async function handleVote(rating) {
    if (voted !== null || pending) return;
    const token = begin(); if (token === null) return;
    hapticTap();
    setPending(true);
    setError('');
    try {
      await set(ref(db, `sessions/${sessionId}/quickSurvey/${pid}`), { rating, timestamp: serverTimestamp() });
      if (finish(token)) setVoted(rating);
    } catch {
      if (finish(token)) setError('응답을 저장하지 못했어요. 다시 선택해주세요.');
    } finally {
      if (isCurrent(token)) setPending(false);
    }
  }

  return (
    <div className={`${embedded ? "w-full py-4" : "min-h-dvh p-6"} bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center`}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="text-center space-y-8 w-full max-w-sm"
      >
        <div className="space-y-2">
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">빠른 설문</p>
          <p className="text-slate-600 dark:text-slate-300 text-[15px]">오늘 수업은 어떠셨나요?</p>
        </div>

        <div className="flex gap-2 justify-center w-full">
          {RATINGS.map((rating, i) => {
            const isSelected = voted === rating;
            const hasVoted = voted !== null;
            return (
              <motion.button
                key={rating}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{
                  opacity: hasVoted && !isSelected ? 0.25 : 1,
                  scale: isSelected ? 1.15 : 1,
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 25, delay: i * 0.05 }}
                whileTap={{ scale: 0.85 }}
                onClick={() => handleVote(rating)}
                disabled={hasVoted || pending}
                className={`flex-1 min-w-0 min-h-12 h-14 rounded-2xl flex items-center justify-center text-xl font-bold transition-colors duration-150 ${
                  isSelected
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-lg'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm'
                } ${hasVoted && !isSelected ? 'cursor-not-allowed' : ''}`}
              >
                {rating}
              </motion.button>
            );
          })}
        </div>

        {/* Labels */}
        <div className="flex justify-between px-1 text-sm text-slate-600 dark:text-slate-300">
          <span>매우 아쉬움</span>
          <span>매우 좋음</span>
        </div>

        {pending && <p role="status" className="text-sm text-slate-500 dark:text-slate-300">응답을 보내는 중...</p>}
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {voted && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-1"
          >
            <p className="text-slate-600 dark:text-slate-300 text-sm">응답이 기록되었습니다</p>
            <p className="text-slate-300 text-xs">{RATING_LABELS[voted - 1]}</p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

/** Bar chart for presenter */
function SurveyBarChart({ counts, total, presenter = false }) {
  const maxCount = Math.max(...Object.values(counts), 1);

  return (
    <div className={`w-full space-y-3 ${presenter ? "max-w-[1000px]" : "max-w-md"}`}>
      {RATINGS.map(rating => {
        const count = counts[rating] || 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const barPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
        return (
          <div key={rating} className="flex items-center gap-3">
            <span className={`${presenter ? "w-10 text-2xl" : "w-6 text-lg"} text-center font-bold text-slate-900 dark:text-slate-100 tabular-nums`}>{rating}</span>
            <div className={`${presenter ? "h-10" : "h-8"} flex-1 bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden`}>
              {count > 0 && <motion.div
                className="h-full bg-indigo-500 dark:bg-indigo-400 rounded-lg"
                initial={{ width: 0 }}
                animate={{ width: `${barPct}%` }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              />}
            </div>
            <span className={`${presenter ? "w-20 text-2xl" : "w-14 text-sm"} text-right font-semibold text-slate-600 dark:text-slate-300 tabular-nums`}>{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

/** Presenter view — bar chart + average */
export function SurveyPresenter({ sessionId, onReset, presenter = false, readOnly = false }) {
  const [responses, setResponses] = useState({});
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState('');

  useEffect(() => {
    if (!sessionId) return;
    const surveyRef = ref(db, `sessions/${sessionId}/quickSurvey`);
    const unsub = onValue(surveyRef, snap => setResponses(snap.val() || {}), () => {});
    return () => unsub();
  }, [sessionId]);

  const entries = Object.values(responses);
  const total = entries.length;
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  entries.forEach(e => { if (counts[e.rating] !== undefined) { counts[e.rating]++; sum += e.rating; } });
  const avg = total > 0 ? (sum / total).toFixed(1) : '-';

  return (
    <div className={`flex flex-col items-center gap-6 w-full mx-auto ${presenter ? "paper-surface max-w-[1100px]" : "max-w-lg"}`} onClick={e => e.stopPropagation()}>
      <h3 className={`${presenter ? "text-3xl md:text-4xl" : "text-2xl"} font-bold tracking-tight text-slate-900 dark:text-slate-100`}>빠른 설문</h3>

      {/* Average score */}
      <div className="text-center space-y-1">
        <motion.p
          key={avg}
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          className="text-6xl font-bold text-slate-900 dark:text-slate-100 tracking-tight tabular-nums"
        >
          {avg}
        </motion.p>
        <p className={presenter ? "text-2xl text-slate-300" : "text-slate-600 dark:text-slate-300 text-sm"}>평균 (5점 만점) · {total}명 응답</p>
      </div>

      <SurveyBarChart counts={counts} total={total} presenter={presenter} />

      {!readOnly && (total > 0 || resetting) && (
        <Button onClick={async () => {
          if (resetting) return;
          setResetting(true); setResetError('');
          try { await remove(ref(db, `sessions/${sessionId}/quickSurvey`)); onReset?.(); }
          catch { setResetError('응답을 초기화하지 못했어요. 연결 상태를 확인하고 다시 시도해주세요.'); }
          finally { setResetting(false); }
        }} disabled={resetting} variant="secondary" size="sm" className="min-h-11">
          <RotateCcw size={18} /> {resetting ? '초기화 중…' : '응답 초기화'}
        </Button>
      )}
      {!readOnly && resetError && <p role="alert" className="text-sm text-red-500 dark:text-red-300">{resetError}</p>}
    </div>
  );
}

export default memo(StudentSurvey);
