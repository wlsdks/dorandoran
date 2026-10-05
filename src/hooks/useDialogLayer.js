import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

const layers = [];
let previousOverflow = '';
const focusableSelector = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** 시트·모달은 같은 Escape/포커스/배경 스크롤 규칙을 따른다. 가장 위의 창만 닫는다. */
export function useDialogLayer(open, onClose) {
  const dialogRef = useRef(null), closeRef = useRef(onClose), layerRef = useRef(null);
  useLayoutEffect(() => { closeRef.current = onClose; }, [onClose]);
  const trapFocus = useCallback(event => {
    if (event.key !== 'Tab' || event.defaultPrevented || !dialogRef.current || layers.at(-1) !== layerRef.current) return;
    const elements = [...dialogRef.current.querySelectorAll(focusableSelector)].filter(element => !element.matches(':disabled') && element.tabIndex >= 0 && !element.closest('[hidden],[inert]') && element.getClientRects().length);
    event.preventDefault(); event.stopPropagation();
    if (!elements.length) { dialogRef.current.focus(); return; }
    const index = elements.indexOf(document.activeElement);
    const next = index < 0 ? (event.shiftKey ? elements.length - 1 : 0) : (index + (event.shiftKey ? -1 : 1) + elements.length) % elements.length;
    elements[next].focus();
  }, []);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement, layer = {};
    if (!layers.length) { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    layers.push(layer);
    layerRef.current = layer;
    const frame = requestAnimationFrame(() => dialogRef.current?.focus());
    const escape = event => {
      if (event.defaultPrevented || layers.at(-1) !== layer) return;
      // 단계 전환으로 포커스된 요소가 사라져도 다음 Tab은 열린 창으로 돌아온다.
      if (event.key === 'Tab' && !dialogRef.current?.contains(document.activeElement)) {
        trapFocus(event); return;
      }
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation(); closeRef.current?.();
    };
    document.addEventListener('keydown', escape, true);
    return () => {
      cancelAnimationFrame(frame); document.removeEventListener('keydown', escape, true);
      const wasTop = layers.at(-1) === layer, index = layers.indexOf(layer);
      if (index >= 0) layers.splice(index, 1);
      if (layerRef.current === layer) layerRef.current = null;
      if (!layers.length) document.body.style.overflow = previousOverflow;
      if (wasTop && previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open, trapFocus]);
  return { dialogRef, trapFocus };
}
