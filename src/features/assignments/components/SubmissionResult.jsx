import { useAIAvailability } from '@/hooks/useAIAvailability';
import { motion } from 'framer-motion';
import { Trophy, Clock } from 'lucide-react';
import { JUDGES, AWARDS, getAwardById } from '@/lib/judging/judges';
import JudgeResultCard from './JudgeResultCard';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';

/**
 * SubmissionResult — 학생이 본인 심사 결과를 확인하는 화면.
 */
export default function SubmissionResult({ submission, results, awards, passThreshold = 3 }) {
  const { available } = useAIAvailability();
  if (!available) return <div className="text-center rounded-xl bg-white dark:bg-slate-800 p-6 space-y-2">
    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">제출이 완료되었습니다</p>
    <p className="text-sm text-slate-500 dark:text-slate-300">강사가 확인하고 다음 안내를 드릴 거예요.</p>
  </div>;
  if (!results) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="flex flex-col items-center justify-center py-16 space-y-4"
      >
        <DoranDoranMascot size="md" mood="waiting" />
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Clock size={16} className="text-slate-400" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">심사가 아직 진행 중입니다</h3>
          </div>
          <p className="text-sm text-slate-400">AI 심사위원들이 제출물을 평가하고 있어요.<br />잠시 후 다시 확인해주세요.</p>
        </div>
      </motion.div>
    );
  }

  const { judges, summary } = results;
  const passed = (summary?.selectedCount ?? 0) >= passThreshold;
  const myAward = awards
    ? Object.entries(awards).find(([, v]) => v.submissionId === submission.id)?.[0]
    : null;
  const awardInfo = myAward ? getAwardById(myAward) : null;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="text-center space-y-3"
      >
        <p className="text-sm text-slate-400">{submission.name}님의 심사 결과</p>
        <motion.p
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22, delay: 0.1 }}
          className="text-5xl font-bold text-slate-900 dark:text-slate-100 tracking-tight tabular-nums"
        >
          {summary.avgScore}
        </motion.p>
        <p className="text-slate-400 text-sm">평균 점수 (10점 만점)</p>
        <div className="flex items-center justify-center gap-3">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
            passed
              ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
          }`}>
            {passed ? '합격' : '불합격'}
          </span>
          <span className="text-sm text-slate-400">
            {summary.selectedCount}/{summary.totalJudges}명 선택
          </span>
        </div>

        {/* Award badge */}
        {awardInfo && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22, delay: 0.3 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-full text-sm font-bold"
          >
            <Trophy size={16} />
            {awardInfo.name}
          </motion.div>
        )}
      </motion.div>

      {/* Judge results */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">심사위원 평가</p>
        {JUDGES.map((judge, i) => (
          <motion.div
            key={judge.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25, delay: i * 0.05 }}
          >
            <JudgeResultCard judge={judge} result={judges?.[judge.id]} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
