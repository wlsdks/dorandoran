import { useAIAvailability } from '@/hooks/useAIAvailability';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThumbsUp, MessageSquare, Send, ChevronDown, ChevronUp, Check, EyeOff, Eye, ShieldAlert, Lightbulb } from 'lucide-react';
import { timeAgo } from '@/lib/utils';
import AnswerItem from './AnswerItem';

export default function QuestionCard({ question: originalQuestion, index, pid, nickname, role, isAdmin, onUpvote, onPostAnswer, onAnswerUpvote, onToggleHidden }) {
  const { available } = useAIAvailability();
  const readonly = role === 'viewer';
  const q = !available && !isAdmin ? { ...originalQuestion, answerList: (originalQuestion.answerList || []).filter(answer => answer.role !== 'ai'), answeredByRole: originalQuestion.answeredByRole === 'ai' ? null : originalQuestion.answeredByRole, aiAllowed: false } : originalQuestion;
  const [expanded, setExpanded] = useState(false);
  const [answerText, setAnswerText] = useState('');
  const [posting, setPosting] = useState(false);
  const isOwn = q.participantId === pid;
  const hasUpvoted = q.upvotes?.[pid];
  const isHidden = q.hidden === true;

  // 학생에게 숨겨진 질문: 플레이스홀더 표시
  if (isHidden && !isAdmin) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25, delay: index * 0.03 }}
        className="rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 p-4"
      >
        <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
          <ShieldAlert size={16} />
          <p className="text-sm">정책상 가려진 질문입니다</p>
        </div>
      </motion.div>
    );
  }

  async function handlePostAnswer() {
    if (readonly || !answerText.trim() || posting) return;
    setPosting(true);
    const success = await onPostAnswer(q.id, answerText.trim(), nickname, pid, role);
    if (success) setAnswerText('');
    setPosting(false);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, delay: index * 0.03 }}
      className={`rounded-xl shadow-sm overflow-hidden transition-all duration-300 bg-white dark:bg-slate-800 ${
        isHidden
          ? 'ring-1 ring-red-300 dark:ring-red-800/50 opacity-70'
          : q.answeredByRole
            ? 'ring-1 ring-emerald-300 dark:ring-emerald-800/50'
            : ''
      }`}
    >
      <div className="p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
              {q.nickname}
            </span>
            {isOwn && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">나</span>}
            {isHidden && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                <EyeOff size={9} /> 숨김
              </span>
            )}
            {q.answeredByRole && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                <Check size={10} className="text-emerald-500" />
                {q.answeredByRole === 'staff' ? '스태프 답변' : q.answeredByRole === 'ai' ? 'AI 답변' : '강사 답변'}
              </span>
            )}
            {q.aiAllowed && q.aiSkipped && !q.answeredByRole && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400" title="AI가 확실하지 않아 답변 보류">
                AI 판단 보류
              </span>
            )}
            {q.aiAllowed && !q.aiSkipped && !q.answeredByRole && (q.answerCount || 0) === 0 && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                <Lightbulb size={9} className="animate-pulse text-indigo-500" />
                AI 확인 중
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isAdmin && onToggleHidden && (
              <button
                onClick={() => onToggleHidden(q.id)}
                className={`min-h-11 min-w-11 flex items-center justify-center p-1.5 rounded-lg text-xs transition-colors duration-150 ${
                  isHidden
                    ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-700'
                }`}
                title={isHidden ? '질문 공개' : '질문 숨기기'} aria-label={isHidden ? '질문 공개' : '질문 숨기기'}
              >
                {isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            )}
            <span className="text-[11px] text-slate-400 dark:text-slate-500">{timeAgo(q.timestamp)}</span>
          </div>
        </div>

        <p className={`text-base leading-snug line-clamp-2 ${isHidden ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>{q.text}</p>

        {/* Actions row */}
        <div className="flex flex-wrap items-center gap-3 pt-0.5">
          <button
            disabled={readonly} onClick={() => onUpvote(q.id, pid)} aria-label={hasUpvoted ? '질문 공감 취소' : '질문에 공감하기'} aria-pressed={!!hasUpvoted}
            className={`min-h-11 min-w-11 px-2 flex items-center justify-center gap-1.5 text-sm font-medium transition-colors duration-150 ${
              hasUpvoted
                ? 'text-slate-900 dark:text-slate-100'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <ThumbsUp size={15} className={hasUpvoted ? 'fill-current' : ''} />
            <span className="tabular-nums font-bold">{q.upvoteCount}</span>
          </button>

          <button
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            className="min-h-11 px-2 flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors duration-150"
          >
            <MessageSquare size={14} />
            <span>{q.answerCount > 0 ? `답변 ${q.answerCount}개` : '답변하기'}</span>
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {/* Answers section (expandable) */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 px-4 py-3 space-y-3">
              {q.text.length > 60 && (
                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed pb-2 border-b border-slate-100 dark:border-slate-700">{q.text}</p>
              )}
              {q.answerList.length > 0 ? (
                q.answerList.map((a) => (
                  <AnswerItem key={a.id} answer={a} questionId={q.id} pid={pid} onUpvote={readonly ? undefined : onAnswerUpvote} />
                ))
              ) : (
                <p className="text-xs text-slate-400 text-center py-2">아직 답변이 없습니다</p>
              )}
              {!readonly && <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handlePostAnswer()}
                  placeholder="답변 작성..."
                  maxLength={500}
                  className="flex-1 min-w-0 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                <button
                  onClick={handlePostAnswer}
                  disabled={!answerText.trim() || posting}
                  aria-label="답변 등록"
                  className="min-h-11 min-w-11 flex items-center justify-center px-3 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors duration-150 hover:bg-slate-800 dark:hover:bg-slate-200"
                >
                  <Send size={14} />
                </button>
              </div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
