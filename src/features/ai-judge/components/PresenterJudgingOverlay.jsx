import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, Crown, Trophy, Medal, Award, Clock, Lightbulb } from 'lucide-react';
import { JUDGES } from '@/lib/judging/judges';

/**
 * 프레젠터 화면용 — AI 심사 진행 중 표시. 좌측 현재 학생 작품 + 우측 7판사 라이브 패널 + 실시간 랭킹.
 *
 * 연출 요소:
 * - 헤더: 큰 진행률 + 남은 약 X초 카운트다운
 * - 우측 상단: 실시간 미니 랭킹 (지금까지 점수 상위 3명)
 * - 판사 카드: thinking dots + 점수 count-up
 * - 새 1등 등장 시 sparkle
 */
export default function PresenterJudgingOverlay({ judgeState, judgeLog, submissions, results }) {
  const current = judgeState?.current ?? 0;
  const total = judgeState?.total ?? 0;
  const currentName = judgeLog?.currentName || judgeState?.currentName || '';
  const pct = total ? (current / total) * 100 : 0;
  const startedAt = judgeState?.startedAt;

  const currentSubmission = submissions?.find((s) => s.name === currentName);
  const judgeLogs = judgeLog?.judges || {};

  // 실시간 랭킹 — 완료된 학생 점수 상위 3명
  const leaderboard = useMemo(() => {
    if (!results) return [];
    const entries = Object.entries(results)
      .map(([pid, r]) => ({
        pid,
        avg: r.summary?.avgScore ?? 0,
        valid: r.summary?.totalJudges ?? 0,
      }))
      .filter((e) => e.valid > 0)
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3);
    return entries.map((e) => {
      const sub = submissions?.find((s) => s.id === e.pid);
      return { ...e, name: sub?.name || '익명' };
    });
  }, [results, submissions]);

  // 남은 시간 추정 — (completed/elapsed) 페이스로 남은 건수 예상
  const remaining = useEstimatedRemaining(startedAt, current, total);

  return (
    <div className="w-full max-w-[92rem] mx-auto flex flex-col gap-6 px-4 py-6" role="status" aria-live="polite">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 rounded-full bg-slate-900 dark:bg-slate-100 flex items-center justify-center shrink-0"
          >
            <Lightbulb size={22} className="text-white dark:text-slate-900" />
          </motion.div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">AI 심사 진행 중</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm tabular-nums flex items-center gap-2">
              <span><span className="font-bold text-slate-700 dark:text-slate-200">{current}</span> / {total}명 심사 중</span>
              {remaining !== null && remaining > 0 && (
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <Clock size={11} /> 약 {remaining}초 남음
                </span>
              )}
            </p>
          </div>
        </div>
        {total > 0 && (
          <div className="flex-1 min-w-[160px] max-w-md h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-indigo-500 rounded-full"
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        )}
      </div>

      {/* 실시간 미니 랭킹 — 점수 들어올 때마다 갱신 */}
      <Leaderboard items={leaderboard} />

      {/* 본문 — 좌:현재작품 / 우:판사 패널 */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,28rem)_1fr] gap-6 items-start">
        {/* 현재 심사 중인 학생 작품 카드 */}
        <AnimatePresence mode="wait">
          {currentName && (
            <motion.div
              key={currentName}
              initial={{ opacity: 0, scale: 0.92, rotate: -1.2, y: 12 }}
              animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -8 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden"
            >
              {currentSubmission?.imageUrl ? (
                <img src={currentSubmission.imageUrl} alt={`${currentName} 제출물`} className="w-full aspect-square object-cover" />
              ) : currentSubmission?.code ? (
                <div className="w-full aspect-square bg-slate-900 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <span className="text-4xl font-mono">{'</>'}</span>
                  <span className="text-sm uppercase tracking-wider">HTML 코드</span>
                </div>
              ) : (
                <div className="w-full aspect-square bg-slate-50 dark:bg-slate-700" />
              )}
              <div className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-base font-bold text-slate-600 dark:text-slate-300 shrink-0">
                  {currentName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">{currentName}</p>
                  {currentSubmission?.title && (
                    <p className="text-sm text-slate-400 truncate">{currentSubmission.title}</p>
                  )}
                </div>
                <span className="text-xs text-indigo-600 dark:text-indigo-300 font-semibold tabular-nums shrink-0">심사 중</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 7명 심사위원 라이브 패널 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 px-1">
            <Lightbulb size={14} className="text-slate-400" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">AI 심사위원 7명</p>
            <span className="text-[11px] text-slate-400">동시에 평가 중</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {JUDGES.map((judge) => {
              const log = judgeLogs[judge.id];
              return <JudgeLiveCard key={judge.id} judge={judge} log={log} />;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 점수 count-up — 0 → target까지 0.6초 ease-out 애니메이션.
 * 같은 점수가 다시 들어오면 재실행 안 함.
 */
function useCountUp(target, durationMs = 600) {
  const [value, setValue] = useState(typeof target === 'number' ? 0 : null);
  const lastTargetRef = useRef(null);

  useEffect(() => {
    if (typeof target !== 'number') { setValue(null); return; }
    if (lastTargetRef.current === target) return;
    lastTargetRef.current = target;
    const start = performance.now();
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}

/** thinking 점점 dots — 350ms 마다 한 점씩 추가, 4 사이클. */
function useThinkingDots() {
  const [n, setN] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setN((x) => (x % 4) + 1), 350);
    return () => clearInterval(id);
  }, []);
  return '.'.repeat(n);
}

/** 남은 시간 추정 — 1초마다 업데이트. completedSec / completed × remainingCount. */
function useEstimatedRemaining(startedAt, completed, total) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!startedAt || !total) return null;
  if (completed <= 0) return null;
  if (completed >= total) return 0;
  const elapsed = (now - startedAt) / 1000;
  const remainingCount = total - completed;
  const perItem = elapsed / completed;
  return Math.max(1, Math.round(perItem * remainingCount));
}

const RANK_META = [
  { Icon: Crown, color: 'text-amber-500', label: '1위' },
  { Icon: Trophy, color: 'text-slate-400', label: '2위' },
  { Icon: Medal, color: 'text-amber-400', label: '3위' },
];

const Leaderboard = memo(function Leaderboard({ items }) {
  if (!items?.length) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1 shrink-0">
        <Award size={12} /> 실시간 점수
      </span>
      <div className="flex items-center gap-2 flex-wrap">
        {items.map((it, i) => {
          const meta = RANK_META[i];
          if (!meta) return null;
          const Icon = meta.Icon;
          return (
            <motion.div
              key={`${it.pid}-${i}`}
              layout
              initial={{ opacity: 0, scale: 0.85, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 360, damping: 22 }}
              className="inline-flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-3 py-1.5"
            >
              <Icon size={13} className={meta.color} />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[10rem]">{it.name}</span>
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 tabular-nums">{it.avg.toFixed(1)}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
});

const JudgeLiveCard = memo(function JudgeLiveCard({ judge, log }) {
  const state = log?.state || 'waiting'; // waiting | thinking | done | error
  const hint = log?.hint;
  const score = log?.score;
  const dots = useThinkingDots();
  const animatedScore = useCountUp(typeof score === 'number' ? score : null);

  // 상태는 보더 색상으로만 신호 — 배경 tint 제거 (§1)
  const stateColor = state === 'done' ? 'border-emerald-300 dark:border-emerald-500/40 bg-white dark:bg-slate-800'
    : state === 'thinking' ? 'border-indigo-300 dark:border-indigo-500/40 bg-white dark:bg-slate-800'
    : state === 'error' ? 'border-red-300 dark:border-red-500/40 bg-white dark:bg-slate-800'
    : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800';

  return (
    <motion.div
      layout
      className={`relative rounded-xl border p-3 transition-colors ${stateColor}`}
    >
      <div className="flex items-start gap-2.5">
        {/* 판사 아바타 — slate bg 통일, 상태는 ring + 텍스트 색상으로 표현 (§1) */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 bg-slate-100 dark:bg-slate-700 ${
          state === 'thinking' ? 'text-slate-700 dark:text-slate-200 ring-2 ring-indigo-400/60 dark:ring-indigo-400/50 animate-pulse'
          : state === 'done' ? 'text-emerald-600 dark:text-emerald-300 ring-2 ring-emerald-400/60 dark:ring-emerald-400/50'
          : 'text-slate-500 dark:text-slate-400'
        }`}>
          {judge.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{judge.name}</p>
            <span className="text-[10px] text-slate-400 truncate">· {judge.role}</span>
          </div>
          {/* 상태별 표시 */}
          <AnimatePresence mode="wait">
            {state === 'waiting' && (
              <motion.p key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[11px] text-slate-400 mt-1">대기 중…</motion.p>
            )}
            {state === 'thinking' && (
              <motion.div
                key={`think-${hint}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-start gap-1.5 mt-1"
              >
                <Loader2 size={11} className="text-indigo-500 animate-spin shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  <span>{hint || '고민 중'}</span>
                  <span className="text-indigo-500 ml-0.5 tabular-nums">{dots}</span>
                </p>
              </motion.div>
            )}
            {state === 'done' && (
              <motion.div
                key={`done-${score}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-1.5 mt-1"
              >
                <CheckCircle2 size={11} className="text-emerald-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed truncate">{hint}</p>
                  {typeof score === 'number' && (
                    <p className="text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                      {animatedScore !== null ? animatedScore.toFixed(1) : score.toFixed(1)}
                      <span className="text-[10px] text-slate-400 font-normal"> / 10</span>
                    </p>
                  )}
                </div>
              </motion.div>
            )}
            {state === 'error' && (
              <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1">
                <p className="text-[11px] text-red-500 font-medium">평가 실패</p>
                {hint && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate" title={hint}>{hint}</p>}
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  (API 한도 또는 네트워크 문제일 수 있어요. 다시 심사를 시도해보세요)
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
});
