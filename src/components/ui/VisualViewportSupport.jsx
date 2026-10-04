import { useEffect } from 'react';

/** iOS/Android 키보드가 줄이는 실제 보이는 영역을 모바일 대화창에 전달한다. */
export default function VisualViewportSupport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    let frame = null;
    const measure = () => {
      frame = null;
      const height = viewport?.height || window.innerHeight;
      const top = viewport?.offsetTop || 0;
      const root = document.documentElement;
      root.style.setProperty('--app-visible-height', `${height}px`);
      root.style.setProperty('--app-visible-top', `${top}px`);
      root.dataset.keyboardOpen = String(window.innerHeight - height - top > 120);
    };
    const schedule = () => { if (frame === null) frame = requestAnimationFrame(measure); };
    measure(); viewport?.addEventListener('resize', schedule); viewport?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', schedule); viewport?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      const root = document.documentElement;
      root.style.removeProperty('--app-visible-height'); root.style.removeProperty('--app-visible-top'); delete root.dataset.keyboardOpen;
    };
  }, []);
  return null;
}
