import { useEffect, useCallback, useRef } from 'react';
import BottomSheet from '@/components/ui/BottomSheet';
import ReactionBar from '@/features/reactions/components/ReactionBar';

const BODY_PROPS = { 'data-reaction-scroll': '' };

/** 반응 시트 — 키보드가 올라와 본문이 줄어도 한마디 입력과 보내기 버튼을 함께 보이게 유지한다. */
export default function ReactionSheet({ open, onClose, sessionId }) {
  const bodyRef = useRef(null);
  const frameRef = useRef(null);
  const activeRef = useRef(false);
  const keepInputVisible = useCallback(() => {
    if (!activeRef.current) return;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const body = bodyRef.current;
      const controls = body?.querySelector('[data-message-controls]');
      if (!body || !controls) return;
      const viewport = body.getBoundingClientRect(), row = controls.getBoundingClientRect();
      // Safari can leave a newly opened editor below a shrinking scroll viewport.
      // Keep the input and its send action together rather than scrolling only the caret.
      if (row.bottom > viewport.bottom - 8) body.scrollTop += row.bottom - viewport.bottom + 8;
      else if (row.top < viewport.top + 8) body.scrollTop -= viewport.top - row.top + 8;
    });
  }, []);
  useEffect(() => {
    if (!open) return;
    activeRef.current = true;
    const body = bodyRef.current;
    const observer = body && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(keepInputVisible) : null;
    if (body) observer?.observe(body);
    window.visualViewport?.addEventListener('resize', keepInputVisible);
    return () => {
      activeRef.current = false;
      observer?.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      window.visualViewport?.removeEventListener('resize', keepInputVisible);
    };
  }, [open, keepInputVisible]);
  return (
    <BottomSheet open={open} onClose={onClose} title="반응" description="앞 화면에 바로 떠올라요" ariaLabel="반응 보내기" bodyRef={bodyRef} bodyProps={BODY_PROPS} bodyClassName="px-4 pb-4">
      <ReactionBar sessionId={sessionId} bubbleSessionId={sessionId} onInputFocus={keepInputVisible} />
    </BottomSheet>
  );
}
