import { memo } from 'react';
import { motion } from 'framer-motion';
import { spring } from '@/lib/motion';
import { formatChatTime } from '@/lib/utils';

const ChatMessage = memo(function ChatMessage({ msg, isOwn }) {
  const initial = (msg.sender || '익명').charAt(0);

  if (isOwn) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 12, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={spring.default}
        className="flex flex-col items-end gap-1"
      >
        <div className="inline-block px-4 py-2.5 text-[15px] leading-relaxed bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 rounded-2xl rounded-br-sm max-w-[80%] break-words whitespace-pre-wrap">
          {msg.text}
        </div>
        <span className="text-[11px] text-slate-300 dark:text-slate-500 px-1">{formatChatTime(msg.timestamp)}</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -12, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={spring.default}
      className="flex items-start gap-2.5 max-w-[85%]"
    >
      <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[13px] font-semibold text-slate-600 dark:text-slate-300 shrink-0 mt-0.5">
        {initial}
      </div>
      <div className="flex flex-col items-start gap-1">
        <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
          {msg.sender || '익명'}
          {msg.senderType === 'instructor' && (
            <span className="ml-1.5 text-[11px] font-semibold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">강사</span>
          )}
          {msg.senderType === 'staff' && (
            <span className="ml-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-600 px-1.5 py-0.5 rounded-full">스태프</span>
          )}
        </span>
        <div className="inline-block px-4 py-2.5 text-[15px] leading-relaxed bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-2xl rounded-tl-sm break-words whitespace-pre-wrap">
          {msg.text}
        </div>
        <span className="text-[11px] text-slate-300 dark:text-slate-500 px-1">{formatChatTime(msg.timestamp)}</span>
      </div>
    </motion.div>
  );
});

export default ChatMessage;
