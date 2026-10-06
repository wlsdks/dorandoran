import { useCallback, useState } from 'react';

function readStored(key, fallback, min, max) {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
  } catch { return fallback; }
}

/**
 * 사이드바 폭을 끌어서 조절한다. 폭은 브라우저에 기억해 다음 수업에도 그대로 쓴다.
 * side: 'left'면 오른쪽 경계를, 'right'면 왼쪽 경계를 잡고 끈다.
 */
export function useResizableWidth(key, { initial = 360, min = 280, max = 640, side = 'left' } = {}) {
  const [width, setWidth] = useState(() => readStored(key, initial, min, max));
  const [dragging, setDragging] = useState(false);

  const save = useCallback((value) => { try { localStorage.setItem(key, String(value)); } catch { /* 저장 불가여도 동작 */ } }, [key]);

  const onPointerDown = useCallback((event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    let latest = startWidth;
    setDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const move = (e) => {
      const delta = side === 'left' ? e.clientX - startX : startX - e.clientX;
      latest = Math.min(max, Math.max(min, startWidth + delta));
      setWidth(latest);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setDragging(false);
      save(latest);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [width, side, min, max, save]);

  const onKeyDown = useCallback((event) => {
    const step = event.shiftKey ? 40 : 16;
    const grow = side === 'left' ? 'ArrowRight' : 'ArrowLeft';
    const shrink = side === 'left' ? 'ArrowLeft' : 'ArrowRight';
    if (event.key !== grow && event.key !== shrink) return;
    event.preventDefault();
    setWidth((previous) => {
      const next = Math.min(max, Math.max(min, previous + (event.key === grow ? step : -step)));
      save(next);
      return next;
    });
  }, [side, min, max, save]);

  const reset = useCallback(() => { setWidth(initial); save(initial); }, [initial, save]);

  return { width, dragging, handleProps: { onPointerDown, onKeyDown, onDoubleClick: reset } };
}
