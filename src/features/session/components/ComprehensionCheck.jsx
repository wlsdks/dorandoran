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

// 이해도는 위계가 있는 3단계라 색도 한 계열로: 이해됨 = 강조색, 보통 = 중립 회색, 모르겠음 = 차분한 호박색.
const LEVELS = [
  { key: 'good', label: '이해됨', icon: Smile, dot: 'bg-indigo-500 dark:bg-indigo-400', stroke: 'stroke-indigo-500 dark:stroke-indigo-400' },
  { key: 'okay', label: '보통', icon: Meh, dot: 'bg-slate-400 dark:bg-slate-500', stroke: 'stroke-slate-400 dark:stroke-slate-500' },
  { key: 'confused', label: '모르겠음', icon: Frown, dot: 'bg-amber-500/80 dark:bg-amber-400/70', stroke: 'stroke-amber-500/80 dark:stroke-amber-400/70' },
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
                    ? 'bg-slate-900 text-white ring-4 ring-slate-900/15 shadow-lg dark:bg-slate-100 dark:text-slate-900 dark:ring-white/15'
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

/** 도넛 — 얇은 링, 조각 사이 작은 틈. 가운데는 '이해됨' 비율을 크게. */
function DonutChart({ counts, total, presenter = false }) {
  const size = presenter ? 280 : 180;
  const strokeWidth = presenter ? 18 : 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = total > 0 && LEVELS.filter(l => counts[l.key] > 0).length > 1 ? 4 : 0;

  const segments = useMemo(() => LEVELS.reduce((acc, level) => {
    const count = counts[level.key] || 0;
    const length = total > 0 ? (count / total) * circumference : 0;
    const offset = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].length : 0;
    return [...acc, { ...level, count, length, offset }];
  }, []), [counts, total, circumference]);
  const goodPct = total > 0 ? Math.round((counts.good / total) * 100) : 0;

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth} className="stroke-slate-200 dark:stroke-slate-800" />
        {segments.filter(seg => seg.count > 0).map(seg => {
          const visible = Math.max(seg.length - gap, 1);
          return (
            <motion.circle key={seg.key} cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth}
              className={seg.stroke} strokeDashoffset={-(seg.offset + gap / 2)}
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray: `${visible} ${circumference - visible}` }}
              transition={{ duration: 0.6, ease: 'easeOut' }} />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${presenter ? 'text-6xl' : 'text-4xl'} font-bold tabular-nums tracking-tight text-slate-900 dark:text-slate-100`}>{goodPct}<span className={presenter ? 'text-3xl' : 'text-xl'}>%</span></span>
        <span className={`${presenter ? 'text-lg' : 'text-xs'} font-medium text-slate-500 dark:text-slate-400`}>이해됨</span>
      </div>
    </div>
  );
}

/** Presenter view — 도넛 + 범례(인원·비율). 전자칠판은 16:9라 가로로 나란히 둔다. */
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
    <div className={`flex flex-col items-center w-full mx-auto ${presenter ? 'paper-surface max-w-[1000px] gap-10' : 'max-w-lg gap-6'}`} onClick={e => e.stopPropagation()}>
      <div className="text-center space-y-1">
        <h3 className={`${presenter ? 'text-3xl md:text-4xl' : 'text-2xl'} font-bold tracking-tight text-slate-900 dark:text-slate-100`}>이해도 체크</h3>
        <p className={`${presenter ? 'text-xl' : 'text-sm'} text-slate-500 dark:text-slate-400`}><span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{total}명</span> 응답</p>
      </div>

      <div className={`flex items-center ${presenter ? 'gap-16' : 'flex-col gap-6 sm:flex-row sm:gap-10'}`}>
        <DonutChart counts={counts} total={total} presenter={presenter} />
        <ul className={`${presenter ? 'min-w-[340px] space-y-5' : 'min-w-[220px] space-y-3'}`}>
          {LEVELS.map(level => {
            const count = counts[level.key] || 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <motion.li key={level.key} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
                <span className={`shrink-0 rounded-full ${level.dot} ${presenter ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5'}`} aria-hidden="true" />
                <span className={`flex-1 font-medium text-slate-700 dark:text-slate-200 ${presenter ? 'text-2xl' : 'text-sm'}`}>{level.label}</span>
                <span className={`tabular-nums text-slate-500 dark:text-slate-400 ${presenter ? 'text-xl w-16' : 'text-xs w-10'} text-right`}>{count}명</span>
                <span className={`tabular-nums font-bold text-slate-900 dark:text-slate-100 ${presenter ? 'text-3xl w-24' : 'text-base w-12'} text-right`}>{pct}%</span>
              </motion.li>
            );
          })}
        </ul>
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
