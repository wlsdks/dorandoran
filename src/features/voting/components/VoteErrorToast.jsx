import { motion } from 'framer-motion';
import { spring } from '@/lib/motion';
import { WifiOff } from 'lucide-react';

export default function VoteErrorToast({ message, onRetry }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={spring.default}
      role="alert"
      className="w-full rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 px-4 py-3 flex items-center gap-3"
    >
      <WifiOff size={16} className="text-red-500 shrink-0" />
      <p className="text-sm text-red-700 dark:text-red-400 font-medium flex-1">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 shrink-0"
        >
          다시 시도
        </button>
      )}
    </motion.div>
  );
}
