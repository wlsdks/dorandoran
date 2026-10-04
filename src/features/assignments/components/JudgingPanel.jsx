import { motion } from 'framer-motion';
import { Play, AlertCircle, Loader2 } from 'lucide-react';
import { useAIAvailability } from '@/hooks/useAIAvailability';
import { useJudging } from '@/features/assignments/api/useJudging';
import { useAssignmentActions } from '@/features/assignments/api/useAssignments';
import Button from '@/components/ui/Button';

/**
 * JudgingPanel — 강사가 심사를 실행하고 진행률을 보는 패널.
 */
export default function JudgingPanel({ assignmentId, submissionCount, passThreshold = 3 }) {
  const { configured, reason } = useAIAvailability();
  const { startJudging, isJudging, progress, abort } = useJudging(assignmentId);
  const { updateAssignment } = useAssignmentActions();
  function handleStart() {
    if (!configured) return;
    startJudging();
  }

  function handleThresholdChange(v) {
    const next = Math.max(1, Math.min(7, Number(v) || 3));
    if (next !== passThreshold) updateAssignment(assignmentId, { passThreshold: next });
  }

  if (isJudging && progress) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">심사 진행 중</p>
          <button onClick={abort} className="text-xs text-slate-400 hover:text-red-500 transition-colors duration-150">중단</button>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-300">{progress.currentSubmission}</span>
            <span className="text-slate-400 tabular-nums">{progress.current}/{progress.total}</span>
          </div>
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-indigo-500 dark:bg-indigo-400 rounded-full"
              animate={{ width: `${(progress.current / progress.total) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          {progress.currentJudge && (
            <p className="text-xs text-slate-400">
              <Loader2 size={10} className="inline animate-spin mr-1" />
              {progress.currentJudge} 심사 중...
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          onClick={handleStart}
          variant="primary"
          size="sm"
          disabled={!configured || submissionCount === 0}
        >
          <Play size={14} />
          심사 시작 ({submissionCount}건)
        </Button>
      </div>

      {!configured && <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5"><AlertCircle size={12} className="shrink-0" />{reason}</p>}

      {/* 합격 기준 — 심사 전후 모두 변경 가능. 변경 시 합격/불합격 표시가 즉시 반영됨. */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-700 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">합격 기준</p>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 tabular-nums">
            심사위원 <span className="text-slate-900 dark:text-slate-100 font-semibold">{passThreshold}명</span> 이상 추천
          </p>
        </div>
        <input
          type="range"
          min={1}
          max={7}
          step={1}
          value={passThreshold}
          onChange={(e) => handleThresholdChange(e.target.value)}
          className="w-full accent-slate-900 dark:accent-slate-100"
        />
        <div className="flex justify-between text-[10px] text-slate-300 dark:text-slate-500 px-0.5">
          {[1,2,3,4,5,6,7].map(n => <span key={n}>{n}</span>)}
        </div>
        <p className="text-[11px] text-slate-400 dark:text-slate-500">변경 시 합격/불합격 표시가 즉시 반영돼요 (재심사 불필요)</p>
      </div>
    </div>
  );
}
