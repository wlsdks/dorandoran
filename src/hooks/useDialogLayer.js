import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

const layers = [];
let previousOverflow = '';
const focusableSelector = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** 시트·모달은 같은 Escape/포커스/배경 스크롤 규칙을 따른다. 가장 위의 창만 닫는다. */
export function useDialogLayer(open, onClose) {
  const dialogRef = useRef(null), closeRef = useRef(onClose);
  useLayoutEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement, layer = {};
    if (!layers.length) { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    layers.push(layer);
    const frame = requestAnimationFrame(() => dialogRef.current?.focus());
    const escape = event => {
      if (event.key !== 'Escape' || layers.at(-1) !== layer) return;
      event.preventDefault(); event.stopPropagation(); closeRef.current?.();
    };
    document.addEventListener('keydown', escape, true);
    return () => {
      cancelAnimationFrame(frame); document.removeEventListener('keydown', escape, true);
      const wasTop = layers.at(-1) === layer, index = layers.indexOf(layer);
      if (index >= 0) layers.splice(index, 1);
      if (!layers.length) document.body.style.overflow = previousOverflow;
      if (wasTop && previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);
  const trapFocus = useCallback(event => {
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const elements = [...dialogRef.current.querySelectorAll(focusableSelector)].filter(element => !element.matches(':disabled') && element.tabIndex >= 0 && !element.closest('[hidden],[inert]') && element.getClientRects().length);
    const first = elements[0], last = elements.at(-1);
    if (!first) { event.preventDefault(); dialogRef.current.focus(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first.focus(); }
  }, []);
  return { dialogRef, trapFocus };
}
