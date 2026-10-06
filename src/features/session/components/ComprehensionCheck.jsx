import { useVoteAcknowledgement } from '@/hooks/useVoteAcknowledgement';
import { useRealtimeValue } from '@/hooks/useRealtimeValue';
import { useState, useEffect, useRef, useMemo, memo } from 'react';
import { ref, set, onValue, remove, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { getParticipantId } from '@/lib/participant';
import { motion, AnimatePresence } from 'framer-motion';
import { Smile, Meh, Frown, RotateCcw } from 'lucide-react';
import Button from '@/components/ui/Button';
import { hapticTap } from '@/lib/haptics';

const LEVELS = [
  { key: 'good', label: '이해됨', icon: Smile, color: 'bg-emerald-700', ring: 'ring-emerald-500/30', chartColor: '#10B981' },
  { key: 'okay', label: '보통', icon: Meh, color: 'bg-amber-700', ring: 'ring-amber-500/30', chartColor: '#F59E0B' },
  { key: 'confused', label: '모르겠음', icon: Frown, color: 'bg-red-700', ring: 'ring-red-500/30', chartColor: '#EF4444' },
];

/** Student voting UI */
function StudentComprehension({ sessionId, embedded = false }) {
  const [voted, setVoted] = useState(null);
  const pid = getParticipantId();
  const { begin, finish, canRestore, isCurrent, reset } = useVoteAcknowledgement(`${sessionId}:comprehension:${pid}`);
  const { value: savedVote, loading: voteLoading, error: voteLoadError } = useRealtimeValue(sessionId && pid ? `sessions/${sessionId}/comprehension/${pid}` : null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const sawSavedVote = useRef(false);
  useEffect(() => {
    if (voteLoading || voteLoadError) return;
    if (savedVote !== null) {
      sawSavedVote.current = true;
      if (canRestore() && LEVELS.some(item => item.key === savedVote?.level)) setVoted(savedVote.level);
    } else if (sawSavedVote.current && voted !== null && !pending && reset()) {
      // 저장 확인을 마친 응답이 서버에서 지워진 때만 새 라운드를 연다. 전송 중 rollback은 제외한다.
      sawSavedVote.current = false;
      setVoted(null);
    }
  }, [savedVote, voteLoading, voteLoadError, voted, pending, canRestore, reset]);

  async function handleVote(level) {
    if (voted !== null || pending) return;
    const token = begin(); if (token === null) return;
    hapticTap();
    setPending(true);
    setError('');
    try {
      await set(ref(db, `sessions/${sessionId}/comprehension/${pid}`), { level, timestamp: serverTimestamp() });
      if (finish(token)) setVoted(level);
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
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">이해도 체크</p>
          <p className="text-slate-600 dark:text-slate-300 text-[15px]">지금까지 내용이 이해되시나요?</p>
        </div>

        <div className="flex gap-2 justify-center w-full">
          {LEVELS.map((level, i) => {
            const Icon = level.icon;
            const isSelected = voted === level.key;
            const hasVoted = voted !== null;
            return (
              <motion.button
                key={level.key}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: hasVoted && !isSelected ? 0.3 : 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25, delay: i * 0.08 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleVote(level.key)}
                disabled={hasVoted || pending}
                className={`flex-1 min-w-0 min-h-12 flex flex-col items-center gap-2 px-2 py-4 rounded-2xl transition-colors duration-150 ${
                  isSelected
                    ? `${level.color} text-white ring-4 ${level.ring} shadow-lg`
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm'
                } ${hasVoted && !isSelected ? 'cursor-not-allowed' : ''}`}
              >
                <Icon size={36} strokeWidth={isSelected ? 2.5 : 1.8} />
                <span className="text-sm font-bold">{level.label}</span>
              </motion.button>
            );
          })}
        </div>

        {pending && <p role="status" className="text-sm text-slate-500 dark:text-slate-300">응답을 보내는 중...</p>}
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {voted && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-slate-600 dark:text-slate-300 text-sm"
          >
            응답이 기록되었습니다
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}

/** Donut chart for presenter/admin */
function DonutChart({ counts, total, presenter = false }) {
  const size = presenter ? 300 : 200;
  const strokeWidth = presenter ? 36 : 28;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // reduce로 cumulative offset 누적 — let 변수 reassign 회피
  const segments = useMemo(() => {
    return LEVELS.reduce((acc, level) => {
      const count = counts[level.key] || 0;
      const pct = total > 0 ? count / total : 0;
      const dashLength = pct * circumference;
      const offset = acc.length > 0
        ? acc[acc.length - 1].offset + acc[acc.length - 1].dashLength
        : 0;
      return [...acc, { ...level, count, pct, dashLength, offset }];
    }, []);
  }, [counts, total, circumference]);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth}
          className="text-slate-100 dark:text-slate-700" />
        {segments.filter(seg => seg.count > 0).map(seg => (
          <motion.circle
            key={seg.key}
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={seg.chartColor} strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${seg.dashLength} ${circumference - seg.dashLength}`}
            strokeDashoffset={-seg.offset}
            initial={{ strokeDasharray: `0 ${circumference}` }}
            animate={{ strokeDasharray: `${seg.dashLength} ${circumference - seg.dashLength}` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          key={total}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          className={`${presenter ? "text-5xl" : "text-3xl"} font-bold text-slate-900 dark:text-slate-100 tabular-nums tracking-tight`}
        >
          {total}
        </motion.span>
        <span className={presenter ? "text-xl text-slate-300" : "text-xs text-slate-600 dark:text-slate-300"}>명 응답</span>
      </div>
    </div>
  );
}

/** Presenter view — donut chart + breakdown */
export function ComprehensionPresenter({ sessionId, onReset, presenter = false, readOnly = false }) {
  const [responses, setResponses] = useState({});
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState('');

  useEffect(() => {
    if (!sessionId) return;
    const compRef = ref(db, `sessions/${sessionId}/comprehension`);
    const unsub = onValue(compRef, snap => setResponses(snap.val() || {}), () => {});
    return () => unsub();
  }, [sessionId]);

  const entries = Object.values(responses);
  const total = entries.length;
  const counts = { good: 0, okay: 0, confused: 0 };
  entries.forEach(e => { if (counts[e.level] !== undefined) counts[e.level]++; });

  return (
    <div className={`flex flex-col items-center gap-8 w-full mx-auto ${presenter ? "paper-surface max-w-[1000px]" : "max-w-lg"}`} onClick={e => e.stopPropagation()}>
      <h3 className={`${presenter ? "text-3xl md:text-4xl" : "text-2xl"} font-bold tracking-tight text-slate-900 dark:text-slate-100`}>이해도 체크</h3>

      <DonutChart counts={counts} total={total} presenter={presenter} />

      {/* Breakdown */}
      <div className={`flex gap-6 ${presenter ? "md:gap-16" : ""}`}>
        {LEVELS.map(level => {
          const count = counts[level.key] || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <motion.div
              key={level.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-1"
            >
              <div className={`w-3 h-3 rounded-full mx-auto ${level.color}`} />
              <p className={`${presenter ? "text-4xl" : "text-2xl"} font-bold text-slate-900 dark:text-slate-100 tabular-nums tracking-tight`}>{pct}%</p>
              <p className={presenter ? "text-2xl text-slate-300" : "text-xs text-slate-600 dark:text-slate-300"}>{level.label} ({count})</p>
            </motion.div>
          );
        })}
      </div>

      {!readOnly && (total > 0 || resetting) && (
        <Button onClick={async () => {
          if (resetting) return;
          setResetting(true); setResetError('');
          try { await remove(ref(db, `sessions/${sessionId}/comprehension`)); onReset?.(); }
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

export default memo(StudentComprehension);
