import { useAIAvailability } from '@/hooks/useAIAvailability';
import { motion, useReducedMotion } from 'framer-motion';
import Badge from '@/components/ui/Badge';
import { TYPE_LABELS } from '@/lib/question-types';

/**
 * 질문 카드 헤더 — 진행도 바 + 질문 제목 + 타입 뱃지
 * Props:
 *   question       – 질문 객체 { title, type, betting }
 *   questionId     – string (animation key)
 *   questionProgress – { current, total } | null
 */
export default function QuestionCard({ question, questionId, questionProgress }) {
  const reducedMotion = useReducedMotion();
  const { available } = useAIAvailability();
  return (
    <motion.div
      key={`header-${questionId}`}
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="bg-white dark:bg-slate-800 rounded-2xl shadow-md ring-1 ring-slate-200/70 dark:ring-slate-700 p-6"
    >
      {/* 진행바 + 타입 칩을 한 줄에 — 칩 우측 여백 없애고 제목은 아래 full-width */}
      <div className="flex items-center gap-3 mb-4">
        {questionProgress && (
          <>
            <span className="shrink-0 text-xs font-medium text-slate-400 dark:text-slate-500 tabular-nums">
              질문{' '}
              <motion.span
                key={questionProgress.current}
                initial={{ scale: 0.8, opacity: 0.5 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-block"
              >
                {questionProgress.current}
              </motion.span>
              /{questionProgress.total}
            </span>
            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-indigo-500 dark:bg-indigo-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(questionProgress.current / questionProgress.total) * 100}%` }}
                transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.15 }}
              />
            </div>
          </>
        )}
        {!questionProgress && <div className="flex-1" />}
        <div className="flex items-center gap-1.5 shrink-0">
          {question.type === 'quiz' && question.betting && (
            <Badge variant="neutral">베팅</Badge>
          )}
          <Badge variant="primary">{question.type === 'aiJudge' && !available ? '과제' : TYPE_LABELS[question.type] || question.type}</Badge>
        </div>
      </div>
      <h2 className="[word-break:keep-all] [overflow-wrap:anywhere] text-xl font-bold text-slate-900 dark:text-slate-100 leading-snug tracking-tight">
        {question.title}
      </h2>
      {question.imageUrl && (
        <motion.img
          src={question.imageUrl}
          alt="질문 이미지"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          loading="eager"
          className="mt-4 w-full max-h-52 object-contain rounded-lg"
        />
      )}
    </motion.div>
  );
}
