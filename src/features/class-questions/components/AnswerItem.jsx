import { ThumbsUp, Sparkles } from 'lucide-react';
import { timeAgo } from '@/lib/utils';

export default function AnswerItem({ answer: a, questionId, pid, onUpvote }) {
  const isOwn = a.participantId === pid;
  const hasUpvoted = a.upvotes?.[pid];
  const isAi = a.role === 'ai';
  const isOfficial = a.role === 'admin' || a.role === 'staff';
  const roleLabel = a.role === 'admin' ? '강사' : a.role === 'staff' ? '스태프' : isAi ? 'AI 조교' : null;

  // P2-4: 공식 답변(강사/스태프)은 학생이 한눈에 신뢰할 수 있도록 배경/링으로 시각 강조
  const containerCls = isOfficial
    ? 'rounded-lg bg-slate-50 dark:bg-slate-700/30 ring-1 ring-slate-200 dark:ring-slate-700 px-3 py-2.5'
    : '';

  return (
    <div className={`flex gap-2.5 ${containerCls}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{a.nickname}</span>
          {roleLabel && (
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
              isAi
                ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
            }`}>
              {isAi && <Sparkles size={8} className="text-indigo-500" />}{roleLabel}
            </span>
          )}
          {isOwn && <span className="text-[10px] text-slate-400">나</span>}
          <span className="text-[10px] text-slate-400">{timeAgo(a.timestamp)}</span>
        </div>
        <p className={`text-sm mt-0.5 leading-relaxed ${isOfficial ? 'text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-200'}`}>{a.text}</p>
        <button
          disabled={!onUpvote} onClick={() => onUpvote?.(questionId, a.id, pid)}
          aria-label={hasUpvoted ? '추천 취소' : '추천'}
          aria-pressed={!!hasUpvoted}
          className={`flex items-center gap-1 mt-1 text-xs transition-colors duration-150 ${
            hasUpvoted
              ? 'text-slate-900 dark:text-slate-100 font-semibold'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <ThumbsUp size={11} className={hasUpvoted ? 'fill-current' : ''} />
          {a.upvoteCount > 0 && <span className="tabular-nums">{a.upvoteCount}</span>}
        </button>
      </div>
    </div>
  );
}
