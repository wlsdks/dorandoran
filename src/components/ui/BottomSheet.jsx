import { memo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { X } from 'lucide-react';
import { useDialogLayer } from '@/hooks/useDialogLayer';
import { hapticTap } from '@/lib/haptics';
import { backdropOpacityForDrag, shouldDismissSheet } from '@/lib/sheet-gesture';

const OPEN_SPRING = { type: 'spring', stiffness: 300, damping: 25 };
const EXIT_SPRING = { type: 'spring', stiffness: 420, damping: 38 };
const SNAP_BACK = { bounceStiffness: 300, bounceDamping: 25 };

/**
 * 모바일 바텀 시트. 손잡이·제목 영역에서만 끌어서 닫고(본문은 평소대로 스크롤),
 * 놓는 순간의 속도를 투영해 닫힘을 판정한다. 배경은 끌수록 옅어진다.
 * - variant 'auto': 내용 높이만큼, 본문 스크롤 / 'full': 화면 높이(대화 패널용), 자식이 레이아웃을 가진다.
 * - Escape·포커스 트랩·배경 스크롤 잠금은 useDialogLayer가 맡는다.
 */
export default memo(function BottomSheet({
  open, onClose, ariaLabel, title, description, children,
  variant = 'auto', bodyRef, bodyProps, bodyClassName = '', hideClose = false, closeLabel: closeLabelProp,
}) {
  const { dialogRef, trapFocus } = useDialogLayer(open, onClose);
  const dragControls = useDragControls();
  const reducedMotion = useReducedMotion();
  const y = useMotionValue(0);
  const heightRef = useRef(0);
  const dimOpacity = useTransform(y, value => typeof value === 'number' ? backdropOpacityForDrag(value, heightRef.current || 1) : 1);

  const startDrag = useCallback(event => {
    if (reducedMotion || event.target.closest('button,a,input,textarea,select')) return;
    heightRef.current = dialogRef.current?.offsetHeight || 0;
    dragControls.start(event);
  }, [dragControls, dialogRef, reducedMotion]);

  const endDrag = useCallback((_, info) => {
    const height = heightRef.current || dialogRef.current?.offsetHeight || 0;
    if (shouldDismissSheet({ offset: info.offset.y, velocity: info.velocity.y, height })) { hapticTap(); onClose?.(); }
  }, [dialogRef, onClose]);

  const full = variant === 'full';
  const label = ariaLabel || (typeof title === 'string' ? title : '상세 패널');
  const closeLabel = closeLabelProp || (typeof title === 'string' ? `${title} 닫기` : `${ariaLabel || '패널'} 닫기`);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.16 }}
          className="viewport-overlay fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
          onClick={event => { if (event.target === event.currentTarget) onClose?.(); }}>
          <motion.div aria-hidden="true" style={{ opacity: dimOpacity }} className="pointer-events-none absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div ref={dialogRef} initial={reducedMotion ? false : { y: '100%' }} animate={{ y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { y: '100%', transition: EXIT_SPRING }}
            transition={reducedMotion ? { duration: 0 } : OPEN_SPRING}
            drag={reducedMotion ? false : 'y'} dragControls={dragControls} dragListener={false} dragMomentum={false}
            dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 1 }} dragTransition={SNAP_BACK} onDragEnd={endDrag}
            role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} onKeyDown={trapFocus}
            data-sheet-variant={variant}
            className={`relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[22px] sm:rounded-2xl shadow-2xl min-h-0 flex flex-col overflow-hidden outline-none will-change-transform ${full ? 'sheet-conversation h-[calc(var(--app-visible-height,100dvh)-10vh)] sm:h-[600px] sm:max-h-[85dvh] sm:w-[420px]' : 'max-h-[85dvh]'}`}
            style={{ y, paddingBottom: full ? 0 : 'env(safe-area-inset-bottom)' }}>
            {/* 손잡이 + 제목: 여기서만 드래그가 시작된다. 본문 스크롤과 충돌하지 않는다. */}
            <div onPointerDown={startDrag} data-sheet-handle className="shrink-0 touch-none select-none cursor-grab active:cursor-grabbing">
              <div className="flex justify-center pt-2.5 pb-1" aria-hidden="true"><span className="h-[5px] w-10 rounded-full bg-slate-300 dark:bg-slate-500" /></div>
              {(title || !hideClose) && (
                <div className={`flex items-start justify-between gap-3 pl-5 pr-2 ${title ? 'pt-1 pb-2' : 'min-h-11'}`}>
                  {title && <div className={`min-w-0 flex-1 ${typeof title === 'string' ? 'pt-2.5' : 'pt-0.5'}`}>{typeof title === 'string' ? <h2 className="truncate text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">{title}</h2> : title}{description && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>}</div>}
                  {!hideClose && <button type="button" onClick={onClose} aria-label={closeLabel} className="ml-auto h-12 w-12 shrink-0 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 active:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700 dark:active:bg-slate-600 transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><X size={20} /></button>}
                </div>
              )}
            </div>
            <div ref={bodyRef} {...bodyProps} className={full ? `flex-1 min-h-0 flex flex-col ${bodyClassName}` : `flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-5 ${bodyClassName}`}>{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
});
