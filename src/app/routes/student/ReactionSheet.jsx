import { useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useDialogLayer } from '@/hooks/useDialogLayer';
import ReactionBar from '@/features/reactions/components/ReactionBar';

/** Naturally sized sheet; only its body scrolls when browser chrome or the keyboard reduces the visible viewport. */
export default function ReactionSheet({ open, onClose, sessionId }) {
  const { dialogRef, trapFocus } = useDialogLayer(open, onClose);
  const reduced = useReducedMotion();
  const frameRef = useRef(null);
  const keepInputVisible = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const body = dialogRef.current?.querySelector('[data-reaction-scroll]');
      const controls = body?.querySelector('[data-message-controls]');
      if (!body || !controls) return;
      const viewport = body.getBoundingClientRect(), row = controls.getBoundingClientRect();
      // Safari can leave a newly opened editor below a shrinking scroll viewport.
      // Keep the input and its send action together rather than scrolling only the caret.
      if (row.bottom > viewport.bottom - 8) body.scrollTop += row.bottom - viewport.bottom + 8;
      else if (row.top < viewport.top + 8) body.scrollTop -= viewport.top - row.top + 8;
    });
  }, [dialogRef]);
  useEffect(() => {
    if (!open) return;
    window.visualViewport?.addEventListener('resize', keepInputVisible);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      window.visualViewport?.removeEventListener('resize', keepInputVisible);
    };
  }, [open, keepInputVisible]);
  if (typeof document === 'undefined') return null;
  return createPortal(<AnimatePresence>{open && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.14 }}
    className="viewport-overlay fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 sm:items-center sm:p-4" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <motion.section ref={dialogRef} role="dialog" aria-modal="true" aria-label="반응 보내기" tabIndex={-1} onKeyDown={trapFocus}
      initial={reduced ? false : { y: 8 }} animate={{ y: 0 }} exit={reduced ? { opacity: 0 } : { y: 8, opacity: 0 }} transition={{ duration: reduced ? 0 : 0.16, ease: 'easeOut' }}
      className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-800 shadow-xl flex flex-col min-h-0 overflow-hidden outline-none"
      style={{ maxHeight: 'min(90dvh, calc(var(--app-visible-height, 100dvh) - 1rem))', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <header className="flex items-center justify-between gap-3 px-4 py-2 shrink-0"><h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">반응</h2><button type="button" onClick={onClose} aria-label="반응 닫기" className="w-12 h-12 shrink-0 flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"><X size={20} /></button></header>
      <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-4" data-reaction-scroll><ReactionBar sessionId={sessionId} bubbleSessionId={sessionId} onInputFocus={keepInputVisible} /></div>
    </motion.section>
  </motion.div>}</AnimatePresence>, document.body);
}
