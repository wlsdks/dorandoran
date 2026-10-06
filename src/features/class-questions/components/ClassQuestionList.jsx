import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle, ThumbsUp, Lightbulb } from 'lucide-react';
import { useClassQuestions } from '@/features/class-questions/api/useClassQuestions';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

const ClassQuestionItem = memo(function ClassQuestionItem({ q, onClick }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      role="button"
      aria-label={q.answered ? '답변 완료된 질문' : '미답변 질문 — 클릭하여 확인'}
      className={`p-2.5 rounded-lg text-sm transition-colors duration-150 cursor-pointer ${
        q.answered
          ? 'bg-slate-50 dark:bg-slate-800 opacity-60'
          : 'bg-white dark:bg-slate-700 shadow-sm hover:shadow-md'
      }`}
      onClick={() => onClick(q)}
    >
      <p className="text-slate-700 dark:text-slate-200 leading-relaxed">{q.text}</p>
      <div className="flex items-center justify-between mt-1.5">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-xs">{q.nickname}</span>
          {q.upvoteCount > 0 && (
            <span className="flex items-center gap-0.5 text-slate-400 text-xs" title="추천 수">
              <ThumbsUp size={10} />
              {q.upvoteCount}
            </span>
          )}
        </div>
        {q.answered && (
          <span className={`text-[10px] font-medium inline-flex items-center gap-0.5 ${
            q.answeredByRole === 'ai'
              ? 'text-indigo-500 dark:text-indigo-400'
              : 'text-slate-400 dark:text-slate-500'
          }`}>
            {q.answeredByRole === 'ai' && <Lightbulb size={10} className="shrink-0" />}
            {q.answeredByRole === 'staff' ? '스태프 답변 완료' : q.answeredByRole === 'ai' ? 'AI 답변 완료' : '강사 답변 완료'}
          </span>
        )}
      </div>
    </motion.div>
  );
});

/**
 * Admin-side accordion list of class questions.
 * Shows student-posted questions sorted by upvotes. Instructor can mark answered or dismiss.
 */
function ClassQuestionList({ sessionId, embedded = false }) {
  const { questions, unansweredCount, markAnswered, dismissQuestion } =
    useClassQuestions(sessionId);
  const [collapsed, setCollapsed] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);

  // Shake animation on new question arrival
  const prevCountRef = useRef(questions.length);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (questions.length > prevCountRef.current) {
      setShake(true);
      setTimeout(() => setShake(false), 600);
    }
    prevCountRef.current = questions.length;
  }, [questions.length]);

  const handleQuestionClick = useCallback((q) => {
    setSelectedQuestion(q);
  }, []);

  function handleMarkAnswered() {
    if (selectedQuestion) {
      markAnswered(selectedQuestion.id, '강사', 'admin');
      setSelectedQuestion(null);
    }
  }

  function handleDismiss() {
    if (selectedQuestion) {
      dismissQuestion(selectedQuestion.id);
      setSelectedQuestion(null);
    }
  }

  function handleClose() {
    setSelectedQuestion(null);
  }

  const body = (
    <div className={embedded ? 'space-y-1.5' : 'px-3.5 pb-3 space-y-1.5'}>
      {questions.length === 0 && (
        <p className="text-slate-400 dark:text-slate-500 text-xs py-1">
          학생 질문이 없습니다
        </p>
      )}
      <AnimatePresence>
        {questions.map((q) => (
          <ClassQuestionItem key={q.id} q={q} onClick={handleQuestionClick} />
        ))}
      </AnimatePresence>
    </div>
  );

  const modal = (
      <Modal
        open={!!selectedQuestion}
        onClose={handleClose}
        ariaLabel="수업 질문 확인"
      >
        {selectedQuestion && (
          <div className="text-center">
            <div className="flex justify-center mb-3">
              <HelpCircle size={28} className="text-slate-400" />
            </div>
            <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-1">
              수업 질문
            </h3>
            <p className="text-xs text-slate-400 mb-4">{selectedQuestion.nickname}</p>
            {selectedQuestion.upvoteCount > 0 && (
              <div className="flex items-center justify-center gap-1 text-slate-400 text-sm mb-3">
                <ThumbsUp size={14} />
                <span>추천 {selectedQuestion.upvoteCount}</span>
              </div>
            )}
            <p className="text-lg text-slate-700 dark:text-slate-200 leading-relaxed mb-6">
              {selectedQuestion.text}
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="secondary" size="sm" onClick={handleClose}>
                닫기
              </Button>
              {selectedQuestion.answered ? (
                <Button variant="primary" size="sm" onClick={handleDismiss}>
                  확인
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={handleMarkAnswered}>
                  답변 완료
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
  );

  if (embedded) return <>{body}{modal}</>;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <motion.button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600 transition-colors duration-150"
        aria-expanded={!collapsed}
        animate={shake ? { x: [0, -4, 4, -3, 3, -1, 1, 0] } : {}}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      >
        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
          <HelpCircle size={14} className="text-slate-400" />
          수업 질문
          {unansweredCount > 0 && (
            <motion.span
              key={unansweredCount}
              initial={{ scale: 1.3 }}
              animate={{ scale: 1 }}
              className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[10px] font-bold"
            >
              {unansweredCount}
            </motion.span>
          )}
        </span>
        <motion.div animate={{ rotate: collapsed ? 0 : 180 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={14} className="text-slate-400" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {body}
          </motion.div>
        )}
      </AnimatePresence>
      {modal}
    </div>
  );
}

export default memo(ClassQuestionList);
