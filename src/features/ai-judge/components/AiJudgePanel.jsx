import { useState, memo } from 'react';
import { motion } from 'framer-motion';
import { Play, AlertCircle, Users, RotateCcw, Square, Trophy, Medal, Award, Lightbulb } from 'lucide-react';
import Button from '@/components/ui/Button';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useAIAvailability } from '@/hooks/useAIAvailability';
import { useLiveSubmissions, useLiveJudging, useLiveJudgeResults } from '../api/useLiveJudging';

const DONE_RANK_META = [
  { key: 'first', Icon: Trophy, cls: 'text-amber-500' },
  { key: 'second', Icon: Medal, cls: 'text-slate-400' },
  { key: 'third', Icon: Award, cls: 'text-amber-400' },
];

/**
 * AiJudgePanel — 강사용 라이브 심사 컨트롤.
 * 제출 수 표시 + API 키 세팅 + "심사 시작" 버튼 + 진행률.
 */
export default memo(function AiJudgePanel({ sessionId, questionId }) {
  const { available, reason } = useAIAvailability();
  const { submissions } = useLiveSubmissions(sessionId, questionId);
  const { startJudging, isJudging, progress, abort, reset } = useLiveJudging(sessionId, questionId);
  const { judgeState, top3 } = useLiveJudgeResults(sessionId, questionId);
  const [abortConfirmOpen, setAbortConfirmOpen] = useState(false);

  const count = submissions.length;
  const isDone = judgeState?.status === 'done' && top3;
  const hasError = judgeState?.status === 'error';

  if (!available && !isJudging && !isDone) {
    return (
      <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-2">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
          <AlertCircle size={14} className="text-amber-500" />
          AI 심사
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{reason}</p>
        <Button disabled variant="primary" size="md" className="w-full"><Play size={15} /> {count}건 심사 시작</Button>
      </div>
    );
  }

  if (isJudging) {
    const current = progress?.current || judgeState?.current || 0;
    const total = progress?.total || judgeState?.total || count;
    const currentName = progress?.currentName || judgeState?.currentName || '';
    const pct = total ? (current / total) * 100 : 0;
    return (
      <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <Lightbulb size={14} className="text-slate-500" />
            AI 심사 진행 중
          </p>
          <button
            onClick={() => setAbortConfirmOpen(true)}
            aria-label="심사 중단"
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[36px] text-xs font-medium text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
          >
            <Square size={12} /> 중단
          </button>
          <ConfirmModal
            open={abortConfirmOpen}
            onCancel={() => setAbortConfirmOpen(false)}
            onConfirm={() => { abort(); setAbortConfirmOpen(false); }}
            title="진행 중인 심사를 중단할까요?"
            description="여기까지 심사된 결과는 보존됩니다."
            confirmLabel="중단"
            variant="danger"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-300 truncate">{currentName}</span>
            <span className="text-slate-400 tabular-nums shrink-0 ml-2">{current}/{total}</span>
          </div>
          <div
            className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={current}
            aria-valuemax={total}
            aria-valuemin={0}
            aria-label="AI 심사 진행률"
          >
            <motion.div
              className="h-full bg-indigo-500 rounded-full"
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (isDone) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4 space-y-3">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
          <Lightbulb size={14} className="text-slate-500" /> 심사 완료 — TOP 3 집계됨
        </p>
        <div className="flex flex-wrap gap-1.5">
          {DONE_RANK_META.map(({ key, Icon, cls }) => {
            const w = top3?.[key];
            if (!w) return null;
            return (
              <span key={key} className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-800 rounded-full px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-700">
                <Icon size={12} className={cls} />
                <span className="font-semibold text-slate-700 dark:text-slate-200">{w.name}</span>
                <span className="text-slate-400 tabular-nums">{typeof w.score === 'number' ? w.score.toFixed(1) : '-'}</span>
              </span>
            );
          })}
        </div>
        <Button onClick={reset} disabled={!available} variant="ghost" size="sm">
          <RotateCcw size={13} /> 다시 심사
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
          <Lightbulb size={14} className="text-slate-400" />
          AI 심사
        </p>
        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
          <Users size={12} /> {count}건 제출
        </span>
      </div>

      {hasError && (
        <p className="text-xs text-red-500">오류: {judgeState.message || '심사 실패'}</p>
      )}

      <Button
        onClick={() => { if (available) startJudging(); }}
        variant="primary"
        size="md"
        disabled={!available || count === 0}
        className="w-full"
      >
        <Play size={15} /> {count === 0 ? '제출을 기다리는 중' : `${count}건 심사 시작`}
      </Button>
      {count > 0 && (
        // 예상 시간 = count / CONCURRENCY(2) × 건당 ~7s ÷ 60. 2명 동시 심사 + 판사 pacing(stagger+min think) 반영.
        <p className="text-xs text-slate-400 text-center">심사위원 7명이 병렬로 평가합니다 (약 {Math.max(1, Math.ceil(count * 3.5 / 60))}분)</p>
      )}
      <p className="text-[11px] text-slate-400 text-center sm:hidden">
        모바일은 화면이 잠기면 심사가 중단될 수 있어요. 데스크톱에서 실행을 권장합니다.
      </p>
    </div>
  );
});
