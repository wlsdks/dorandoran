import { useEffect, useCallback } from 'react';

/**
 * Keyboard shortcuts for admin session control.
 *
 * Arrow Right / Arrow Down  → activate next question
 * Arrow Left  / Arrow Up    → activate previous question
 * Space                     → activate next question (same as →)
 * R                         → reveal quiz answer
 * L                         → show leaderboard
 * Escape                    → clear active question (back to waiting)
 *
 * All shortcuts are disabled when:
 * - An input/textarea/select is focused (typing context)
 * - A modal or form is open (showCenterForm)
 * - The session is read-only or ended
 */
export function useAdminKeyboardShortcuts({
  enabled = true,
  questionList = [],       // [[qId, question], ...]
  currentQuestion = null,
  onActivate,
  onReveal,
  onShowLeaderboard,
  onClearActive,
  isQuizFn,
}) {
  const handleKeyDown = useCallback((e) => {
    if (!enabled || e.defaultPrevented || document.querySelector('[role="dialog"]')) return;
    if (e.target?.closest?.('[role="tab"], [role="menu"], details[open]')) return;
    if (e.key === ' ' && e.target?.closest?.('button, a[href]')) return;

    // Skip when user is typing in an input
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) {
      return;
    }

    const activeIndex = questionList.findIndex(([qId]) => qId === currentQuestion);
    // 정답 공개 직후 2.5초는 다음 질문 전진 차단 — 학생이 결과를 볼 틈도 없이 화살표로 넘어가던 오조작 방지.
    const currentQData = activeIndex >= 0 ? questionList[activeIndex][1] : null;
    const advanceBlocked = !!currentQData?.revealedAt && (Date.now() - currentQData.revealedAt) < 2500;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown': {
        e.preventDefault();
        if (advanceBlocked) break;
        const nextIndex = activeIndex >= 0 ? activeIndex + 1 : 0;
        if (nextIndex < questionList.length) {
          onActivate?.(questionList[nextIndex][0]);
        }
        break;
      }

      case 'ArrowLeft':
      case 'ArrowUp': {
        e.preventDefault();
        const prevIndex = activeIndex >= 0 ? activeIndex - 1 : questionList.length - 1;
        if (prevIndex >= 0 && prevIndex < questionList.length) {
          onActivate?.(questionList[prevIndex][0]);
        }
        break;
      }

      case ' ': {
        e.preventDefault();
        if (advanceBlocked) break;
        // Space = advance to next, same as ArrowRight
        const nextIdx = activeIndex >= 0 ? activeIndex + 1 : 0;
        if (nextIdx < questionList.length) {
          onActivate?.(questionList[nextIdx][0]);
        }
        break;
      }

      case 'r':
      case 'R': {
        if (!currentQuestion) break;
        const currentQ = questionList.find(([qId]) => qId === currentQuestion);
        if (currentQ && isQuizFn?.(currentQ[1]) && !currentQ[1].revealedAt) {
          e.preventDefault();
          onReveal?.(currentQuestion);
        }
        break;
      }

      case 'l':
      case 'L': {
        if (!currentQuestion) break;
        const currentQ = questionList.find(([qId]) => qId === currentQuestion);
        if (currentQ && isQuizFn?.(currentQ[1]) && currentQ[1].revealedAt) {
          e.preventDefault();
          onShowLeaderboard?.();
        }
        break;
      }

      case 'Escape': {
        if (currentQuestion) {
          e.preventDefault();
          onClearActive?.();
        }
        break;
      }

      default:
        break;
    }
  }, [enabled, questionList, currentQuestion, onActivate, onReveal, onShowLeaderboard, onClearActive, isQuizFn]);

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}
