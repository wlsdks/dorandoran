import { useState, useRef, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Instant tooltip — shows on hover with no delay.
 * Uses portal to avoid overflow:hidden clipping.
 */
export default memo(function Tooltip({ label, children, multiline = false }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0, above: true });
  const ref = useRef(null);

  const handleEnter = useCallback(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const above = rect.top > 50;
      setPos({
        x: rect.left + rect.width / 2,
        y: above ? rect.top - 6 : rect.bottom + 6,
        above,
      });
    }
    setShow(true);
  }, []);

  return (
    <div
      ref={ref}
      className="relative inline-flex"
      onMouseEnter={handleEnter}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {createPortal(
        <AnimatePresence>
          {show && <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.08 }}
            style={{
              position: 'fixed',
              left: pos.x,
              top: pos.above ? pos.y : undefined,
              bottom: pos.above ? undefined : `calc(100vh - ${pos.y}px)`,
              transform: pos.above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
              zIndex: 9999,
            }}
            className={`px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[11px] font-medium pointer-events-none shadow-lg ${
              multiline ? 'whitespace-pre-line max-w-[260px] leading-relaxed' : 'whitespace-nowrap'
            }`}
          >
            {label}
          </motion.div>}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
});
