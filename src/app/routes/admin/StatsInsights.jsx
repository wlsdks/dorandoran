import { motion } from 'framer-motion';
import { list } from '@/lib/motion';
import EmptyState from '@/components/ui/EmptyState';
import { MessageSquare, Loader2, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { QUESTION_TYPE_MAP } from '@/lib/question-types';

const stagger = list;

export function TrendIndicator({ roundDetails }) {
  if (roundDetails.length < 2) return null;
  const first = roundDetails[0].activityRate;
  const last = roundDetails[roundDetails.length - 1].activityRate;
  const diff = last - first;
  if (Math.abs(diff) < 3) {
    return <span className="flex items-center gap-0.5 text-xs text-slate-400"><Minus size={12} />유지</span>;
  }
  if (diff > 0) {
    return <span className="flex items-center gap-0.5 text-xs text-emerald-600 dark:text-emerald-400"><TrendingUp size={12} />+{diff}%p</span>;
  }
  return <span className="flex items-center gap-0.5 text-xs text-slate-500"><TrendingDown size={12} />{diff}%p</span>;
}

export function MiniTrendLine({ roundDetails }) {
  if (roundDetails.length < 2) return null;
  const rates = roundDetails.map((r) => r.activityRate);
  const max = Math.max(...rates, 1);
  const h = 28;
  const w = 80;
  const step = w / (rates.length - 1);
  const points = rates.map((r, i) => `${i * step},${h - (r / max) * (h - 4)}`).join(' ');
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor"
        className="text-slate-400 dark:text-slate-500" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {rates.map((r, i) => (
        <circle key={i} cx={i * step} cy={h - (r / max) * (h - 4)} r="2"
          className="fill-slate-500 dark:fill-slate-400" />
      ))}
    </svg>
  );
}

export function DifficultQuestions({ questions, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-slate-400">
        <Loader2 size={16} className="animate-spin mr-2" />
        <span className="text-sm">분석 중...</span>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <EmptyState
        title="분석할 질문이 없습니다"
        description="정답이 있는 질문을 3명 이상 참여한 세션에서 분석합니다"
        mascotSize="sm"
        mood="thinking"
        className="py-8"
      />
    );
  }

  return (
    <motion.div variants={stagger.container} initial="initial" animate="animate"
      className="space-y-1">
      {questions.map((q) => {
        const typeInfo = QUESTION_TYPE_MAP[q.type] || { label: q.type, icon: MessageSquare };
        const Icon = typeInfo.icon;
        const isVeryHard = q.correctRate < 30;
        return (
          <motion.div key={`${q.sessionId}-${q.qId}`} variants={stagger.item}
            className="flex items-center gap-3 py-2.5">
            <div className="flex items-center justify-center w-6 h-6 shrink-0">
              {isVeryHard
                ? <AlertTriangle size={14} className="text-slate-500 dark:text-slate-400" />
                : <Icon size={14} className="text-slate-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{q.title}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {q.courseName || '미분류'}{q.roundNumber ? ` ${q.roundNumber}차` : ''}
                <span className="mx-1">&middot;</span>{q.responseCount}명 응답
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className={`text-sm font-bold tabular-nums ${isVeryHard ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}`}>
                {q.correctRate}%
              </p>
              <p className="text-[10px] text-slate-400">
                정답률
                {q.highConfidenceWrongRate > 0 && (
                  <span className="ml-1 text-slate-500 dark:text-slate-400">· 오개념 {q.highConfidenceWrongRate}%</span>
                )}
              </p>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
