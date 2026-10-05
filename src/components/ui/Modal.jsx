import { motion as motionTokens } from '@/lib/design-tokens';
import { useDialogLayer } from '@/hooks/useDialogLayer';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function Modal({ open, onClose, children, className = '', ariaLabel, size = 'md', centered = false, theme = '' }) {
  const { dialogRef, trapFocus } = useDialogLayer(open, onClose);

  // Portal로 document.body에 렌더. 조상 중 display:none/hidden (예: 탭 허브 비활성 탭)
  // 이 있어도 Modal 자체는 영향받지 않음.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className={`viewport-overlay fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex justify-center ${centered ? 'items-center p-4' : 'items-end sm:items-center sm:p-4'} ${theme}`}
          onClick={(e) => e.target === e.currentTarget && onClose?.()}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            tabIndex={-1}
            onKeyDown={trapFocus}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={motionTokens.spring.default}
            /* max-h + 내부 스크롤: 내용이 길어도 팝업이 화면 밖으로 자라지 않는다.
               (강의가 열댓 개면 강의 선택 팝업이 화면을 뚫고 내려가던 문제) */
            className={`bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-lg p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] w-full ${size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md'} outline-none max-h-[88dvh] overflow-y-auto overscroll-contain ${className}`}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
