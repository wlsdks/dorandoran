import { useState, useMemo } from 'react';
import { ref, remove } from 'firebase/database';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, HelpCircle, Check } from 'lucide-react';
import { useUrgentQuestions } from '@/features/questions/api/useUrgentQuestions';
import { useClassQuestions } from '@/features/class-questions/api/useClassQuestions';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { timeAgo } from '@/lib/utils';

export default function StaffQuestionsTab({ sessionId, adminUser }) {
  const { questionList: urgentList } = useUrgentQuestions(sessionId);
  const { questions: classList, markAnswered } = useClassQuestions(sessionId);
  const [selected, setSelected] = useState(null);

  const unified = useMemo(() => {
    const urgent = urgentList.map((q) => ({ ...q, _type: 'urgent' }));
    const classQ = classList.map((q) => ({ ...q, _type: 'class' }));
    return [...urgent, ...classQ].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [urgentList, classList]);

  async function handleConfirm() {
    if (!selected) return;
    if (selected._type === 'urgent') {
      try {
        await remove(ref(db, `sessions/${sessionId}/urgentQuestions/${selected.id}`));
      } catch (err) {
        logger.error('긴급 질문 삭제 실패:', err);
      }
    } else {
      const staffName = adminUser?.displayName || '스태프';
      await markAnswered(selected.id, staffName, 'staff');
    }
    setSelected(null);
  }

  if (unified.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <EmptyState title="질문이 없습니다" description="학생들의 질문이 여기에 표시됩니다" mascotSize="sm" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {unified.map((q) => {
          const isUrgent = q._type === 'urgent';
          const isDimmed = isUrgent ? q.read : q.answered;
          return (
            <motion.div
              key={`${q._type}-${q.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelected(q)}
              className={`p-3.5 rounded-xl text-sm cursor-pointer transition-colors duration-150 ${
                isDimmed
                  ? 'bg-slate-50 dark:bg-slate-800/60 opacity-60'
                  : 'bg-white dark:bg-slate-800 shadow-sm active:bg-slate-50 dark:active:bg-slate-700'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {!isDimmed && <div className="w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-slate-100 mt-2 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-slate-700 dark:text-slate-200 leading-relaxed">{q.text}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      {isUrgent && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                      {isUrgent ? '긴급' : '수업'}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 text-xs">{isUrgent ? '익명' : q.nickname}</span>
                    <span className="text-slate-500 dark:text-slate-300 text-xs">{timeAgo(q.timestamp)}</span>
                    {isDimmed && (
                      <span className="flex items-center gap-0.5 text-slate-500 dark:text-slate-400 text-[10px] ml-auto">
                        <Check size={10} />
                        {isUrgent ? '확인됨' : (q.answeredByRole === 'staff' ? '스태프 답변' : '강사 답변')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      <Modal open={!!selected} onClose={() => setSelected(null)} ariaLabel="질문 확인">
        {selected && (
          <div className="text-center">
            {selected._type === 'urgent' ? (
              <MessageCircle size={28} className="text-slate-500 dark:text-slate-400 mx-auto mb-3" />
            ) : (
              <HelpCircle size={28} className="text-slate-500 dark:text-slate-400 mx-auto mb-3" />
            )}
            <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {selected._type === 'urgent' ? '긴급 질문' : '수업 질문'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {selected._type === 'urgent' ? '익명' : selected.nickname}
            </p>
            <p className="text-lg text-slate-700 dark:text-slate-200 leading-relaxed mt-6 mb-8">
              {selected.text}
            </p>
            <div className="space-y-3">
              <Button variant="primary" size="lg" onClick={handleConfirm} className="w-full">
                {selected._type === 'urgent' ? '확인 (삭제)' : (selected.answered ? '닫기' : '답변 완료')}
              </Button>
              <button
                onClick={() => setSelected(null)}
                className="w-full py-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors duration-150"
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
