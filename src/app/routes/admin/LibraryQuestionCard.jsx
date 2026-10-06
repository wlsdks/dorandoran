import { motion } from 'framer-motion';
import { MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { QUESTION_TYPES } from '@/lib/question-types';

export default function LibraryQuestionCard({ question, onDelete, onEdit, index }) {
  const qType = QUESTION_TYPES.find((t) => t.value === question.type);
  const Icon = qType?.icon || MessageSquare;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-colors duration-150 group"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Icon size={13} className="text-slate-400 shrink-0" />
            <span className="text-xs font-medium text-slate-400">{qType?.label}</span>
            {question.tag && (
              <span className="text-[11px] px-1.5 py-0.5 bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-md border border-slate-100 dark:border-slate-600">
                {question.tag}
              </span>
            )}
          </div>
          <p className="text-slate-800 dark:text-slate-200 text-sm leading-relaxed [word-break:keep-all]">{question.title}</p>
          {question.imageUrl && (
            <img src={question.imageUrl} alt="질문 이미지" loading="lazy" className="mt-2 h-20 max-w-full rounded-lg object-contain border border-slate-100 dark:border-slate-700" />
          )}
          {question.options && (
            <div className="flex flex-wrap gap-1 mt-2">
              {question.options.map((opt, i) => (
                <span
                  key={i}
                  className={`text-xs px-2 py-0.5 rounded-md ${
                    question.correctAnswer === opt
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                      : 'bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {question.optionImages?.[i] && <img src={question.optionImages[i]} alt="" loading="lazy" className="mr-1 inline-block h-4 w-4 rounded-sm object-cover align-[-2px]" />}
                  {opt}
                </span>
              ))}
            </div>
          )}
          {question.type === 'ox' && question.correctAnswer && (
            <div className="flex gap-1.5 mt-2">
              {['O', 'X'].map((v) => (
                <span
                  key={v}
                  className={`text-xs px-2.5 py-0.5 rounded-md font-semibold ${
                    question.correctAnswer === v
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                      : 'bg-slate-50 dark:bg-slate-700 text-slate-400'
                  }`}
                >
                  {v}
                </span>
              ))}
            </div>
          )}
        </div>
        {/* 터치 기기에서도 누를 수 있게 항상 보인다(마우스 호버에서만 보이면 태블릿에서 못 쓴다) */}
        <div className="flex shrink-0 items-center gap-0.5 -mr-1.5 -mt-1.5">
          {onEdit && (
            <button
              onClick={() => onEdit(question)}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors duration-150 active:scale-90"
              title="수정"
              aria-label={`${question.title || "질문"} 수정`}
            >
              <Pencil size={15} />
            </button>
          )}
          <button
            onClick={() => onDelete(question.id)}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors duration-150 active:scale-90"
            title="삭제"
            aria-label={`${question.title || "질문"} 삭제`}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
