import { useAIAvailability } from '@/hooks/useAIAvailability';
import { memo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Pin, ChevronRight, Check, X, Loader2, Lightbulb } from 'lucide-react';
import AiJudgeSubmitter from './AiJudgeSubmitter';
import { useMySubmission, useLiveJudgeResults } from '../api/useLiveJudging';
import { getParticipantId } from '@/lib/participant';

/**
 * PersistentAssignmentCard — 학생 화면의 상시 과제 트리거 카드.
 * 본문(제출 폼/결과)은 탭했을 때 전체화면 Modal로 열려서
 * 다른 질문·콘텐츠와 시각적으로 충돌하지 않게 한다.
 */
export default memo(function PersistentAssignmentCard({ sessionId, questionId, questionTitle }) {
  const { available } = useAIAvailability();
  const [open, setOpen] = useState(false);
  const participantId = getParticipantId();
  const mySubmission = useMySubmission(sessionId, questionId, participantId);
  const { judgeState, top3 } = useLiveJudgeResults(sessionId, questionId);

  const hasSubmitted = !!mySubmission;
  const status = judgeState?.status;
  const isJudging = available && status === 'judging';
  const isDone = available && status === 'done' && top3;

  const stateLabel = isDone ? '결과 확인하기'
    : isJudging ? 'AI 심사 진행 중'
    : hasSubmitted ? '제출 완료 · 수정 가능'
    : '아직 제출 전';

  // 심사 완료 직후 자동으로 모달 열어 결과 노출 (탭 세션 내에서 한 번만).
  // sessionStorage로 기억하지 않으면 WaitingPage↔ActivePollView 전환 시 컴포넌트
  // 재마운트마다 state 초기화 → 학생이 이미 확인/닫은 결과를 자동 재팝업하는 UX 혼란.
  const autoOpenKey = `dorandoran_autoOpened_${sessionId}_${questionId}`;
  const [autoOpenedForResult, setAutoOpenedForResult] = useState(() => {
    try { return sessionStorage.getItem(autoOpenKey) === '1'; } catch { return false; }
  });
  useEffect(() => {
    if (isDone && !autoOpenedForResult) {
      setOpen(true);
      setAutoOpenedForResult(true);
      try { sessionStorage.setItem(autoOpenKey, '1'); } catch { /* 프라이빗 모드 등 */ }
    }
  }, [isDone, autoOpenedForResult, autoOpenKey]);

  // 모달 열린 동안 body 스크롤 + 배경 요소 상호작용 차단
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onEsc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  if (!sessionId || !questionId) return null;

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="w-full flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
        aria-label={`상시 과제 ${questionTitle || ''} 열기`}
      >
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          hasSubmitted ? 'bg-slate-900 dark:bg-slate-100' : 'bg-slate-100 dark:bg-slate-700'
        }`}>
          {hasSubmitted
            ? (isDone
                ? <Lightbulb size={16} className="text-white dark:text-slate-900" />
                : isJudging
                  ? <Loader2 size={16} className="text-white dark:text-slate-900 animate-spin" />
                  : <Check size={16} className="text-white dark:text-slate-900" />)
            : <Pin size={14} className="text-amber-500" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">상시 과제</span>
          </div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {questionTitle || '과제'}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{stateLabel}</p>
        </div>
        <ChevronRight size={16} className="text-slate-300 dark:text-slate-500 shrink-0" />
      </motion.button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              key="persistent-assignment-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              role="dialog"
              aria-modal="true"
              aria-label={`상시 과제: ${questionTitle || ''}`}
              className="fixed inset-0 z-[60] bg-white dark:bg-slate-900 sm:bg-black/50 sm:backdrop-blur-sm sm:flex sm:items-center sm:justify-center sm:p-6"
              onClick={(e) => {
                // 데스크톱에서 배경 클릭으로 닫기 (모바일은 전체 화면이라 배경 없음)
                if (e.target === e.currentTarget) setOpen(false);
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.98, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 8 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                className="w-full h-full sm:h-auto sm:max-h-[92dvh] sm:w-[min(92vw,640px)] sm:rounded-3xl bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-hidden"
              >
                {/* 헤더 — 고정 */}
                <header className="flex items-start justify-between gap-3 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0 sm:px-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Pin size={12} className="text-amber-500" />
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">상시 과제</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight break-words leading-snug">
                      {questionTitle || '과제'}
                    </h2>
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    className="p-2 min-h-[44px] min-w-[44px] rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 -mr-2"
                    aria-label="닫기"
                  >
                    <X size={20} />
                  </button>
                </header>

                {/* 본문 — 스크롤 */}
                <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6">
                  <AiJudgeSubmitter sessionId={sessionId} questionId={questionId} disabled={false} />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
});
