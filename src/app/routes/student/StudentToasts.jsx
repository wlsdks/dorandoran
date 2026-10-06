import { motion, AnimatePresence } from 'framer-motion';
import { rise } from '@/lib/motion';
import { CheckCircle, AlertCircle, Headset, Hand, MessageSquare } from 'lucide-react';

export default function StudentToasts({ submitted, submitError, dmResolved, handAcknowledged, staffReplied, onOpenDM }) {
  return (
    <>
      <AnimatePresence>
        {submitted && (
          <motion.div
            {...rise}
            role="status"
            aria-live="polite"
            className="fixed bottom-[calc(9rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2.5 rounded-lg text-sm font-medium z-50 shadow-lg flex items-center gap-2"
          >
            <CheckCircle size={16} />
            질문이 전송되었습니다
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {submitError && (
          <motion.div
            {...rise}
            role="alert"
            className="fixed bottom-[calc(9rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 bg-red-500 dark:bg-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium z-50 shadow-lg flex items-center gap-2"
          >
            <AlertCircle size={16} />
            {submitError}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {dmResolved && (
          <motion.div
            {...rise}
            role="status"
            aria-live="polite"
            className="fixed bottom-[calc(9rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 bg-emerald-600 dark:bg-emerald-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium z-50 shadow-lg flex items-center gap-2"
          >
            <Headset size={16} />
            {dmResolved}님이 도움을 완료했습니다
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {staffReplied && (
          <motion.button
            {...rise}
            onClick={onOpenDM}
            role="status"
            aria-live="polite"
            className="fixed bottom-[calc(9rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2.5 rounded-lg text-sm font-medium z-50 shadow-lg flex items-center gap-2 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
          >
            <MessageSquare size={16} />
            {staffReplied.isFirst ? `${staffReplied.staffName}님이 답변을 시작했어요` : `${staffReplied.staffName}님의 새 답변`}
            <span className="ml-1 text-[11px] opacity-80">· 탭해서 보기</span>
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {handAcknowledged && (
          <motion.div
            {...rise}
            role="status"
            aria-live="polite"
            className="fixed bottom-[calc(9rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2.5 rounded-lg text-sm font-medium z-50 shadow-lg flex items-center gap-2"
          >
            <Hand size={16} />
            선생님이 확인했어요
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
