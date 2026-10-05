import { memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useDialogLayer } from '@/hooks/useDialogLayer';

/** Mobile sheet: only the handle starts a dismissal drag; content scrolls normally. */
export default memo(function BottomSheet({ open, onClose, ariaLabel, children }) {
  const { dialogRef, trapFocus } = useDialogLayer(open, onClose);
  const dragControls = useDragControls();
  const reducedMotion = useReducedMotion();

  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.15 }}
          className="viewport-overlay fixed inset-0 bg-black/30 backdrop-blur-sm z-[100] flex items-end justify-center"
          onClick={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
          <motion.div ref={dialogRef} initial={reducedMotion ? false : { y: '100%' }} animate={{ y: 0 }} exit={reducedMotion ? { opacity: 0 } : { y: '100%' }}
            transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 25 }}
            drag="y" dragControls={dragControls} dragListener={false} dragConstraints={{ top: 0 }} dragElastic={{ top: 0, bottom: 0.15 }}
            onDragEnd={(_, info) => { if (info.offset.y > 100 || info.velocity.y > 500) onClose?.(); }}
            role="dialog" aria-modal="true" aria-label={ariaLabel || '상세 패널'} tabIndex={-1} onKeyDown={trapFocus}
            className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-2xl shadow-xl max-h-[85dvh] min-h-0 flex flex-col overflow-hidden outline-none"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="flex items-center shrink-0 px-3">
              <div onPointerDown={(event) => dragControls.start(event)} className="min-h-12 flex-1 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing" aria-hidden="true">
                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-500" />
              </div>
              <button type="button" onClick={onClose} aria-label="패널 닫기" className="h-12 w-12 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><X size={20} /></button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
});
