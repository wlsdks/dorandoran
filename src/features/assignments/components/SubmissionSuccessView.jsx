import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useAIAvailability } from '@/hooks/useAIAvailability';

/**
 * 제출 완료 후 성공 화면 — "수정하기" 누르면 폼으로 복귀.
 */
export default function SubmissionSuccessView({ onEdit }) {
  const { available } = useAIAvailability();
  return (
    <motion.div
      key="success"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="flex flex-col items-center justify-center py-16 space-y-4"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22, delay: 0.1 }}
        className="w-16 h-16 rounded-2xl bg-slate-900 dark:bg-slate-100 flex items-center justify-center"
      >
        <Check size={28} className="text-white dark:text-slate-900" />
      </motion.div>
      <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">제출 완료!</h3>
      <p className="text-sm text-slate-400">{available ? '심사 결과는 이 링크에서 확인할 수 있어요' : '제출한 자료는 이 링크에서 다시 확인할 수 있어요'}</p>
      <div className="w-full rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 px-4 py-3 text-center">
        <p className="text-xs text-slate-400 mb-1">{available ? '결과 확인 방법' : '내 제출물 확인 방법'}</p>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          이 페이지에 다시 방문해서<br />
          <span className="font-semibold text-slate-900 dark:text-slate-100">이름 + 조회용 비밀번호</span>로 조회하세요
        </p>
      </div>
      <Button onClick={onEdit} variant="secondary" size="md">수정하기</Button>
    </motion.div>
  );
}
