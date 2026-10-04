import { useEffect, useRef } from 'react';
import { playChime } from '@/lib/chime';

/**
 * Plays a subtle notification chime when a new question activates.
 *
 * @param {string|null} currentQuestionId - The active question ID
 */
export function useQuestionChime(currentQuestionId) {
  const prevRef = useRef(undefined);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevRef.current = currentQuestionId;
      return;
    }

    if (
      currentQuestionId &&
      currentQuestionId !== prevRef.current
    ) {
      const muted = localStorage.getItem('dorandoran_sound_muted') === 'true';
      if (!muted) {
        playChime();
      }
    }

    prevRef.current = currentQuestionId;
  }, [currentQuestionId]);
}
