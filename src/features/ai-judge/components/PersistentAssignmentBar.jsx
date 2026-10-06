import { memo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pin, Users, PinOff, Code2, Lightbulb } from 'lucide-react';
import { useLiveSubmissions, useLiveJudgeResults, usePersistentAssignment } from '../api/useLiveJudging';
import Button from '@/components/ui/Button';
import ConfirmModal from '@/components/ui/ConfirmModal';

/**
 * PersistentAssignmentBar — 강사 어드민 상단에 고정되는 "상시 과제" 요약 바.
 * 슬레이트 기본 카드 + Pin 아이콘 단일 포인트(amber)로 과도한 색 사용 회피.
 */
export default memo(function PersistentAssignmentBar({ sessionId, session, onActivateQuestion }) {
  const assignmentId = session?.persistentAssignmentId || null;
  const question = assignmentId ? session?.questions?.[assignmentId] : null;
  const { clearAssignment } = usePersistentAssignment(sessionId);
  const { submissions } = useLiveSubmissions(sessionId, assignmentId);
  const { judgeState } = useLiveJudgeResults(sessionId, assignmentId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);
  const hoverTimerRef = useRef(null);

  if (!assignmentId || !question || question.type !== 'aiJudge') return null;

  const count = submissions.length;
  const status = judgeState?.status;
  const isActive = session?.currentQuestion === assignmentId;

  const statusLabel = status === 'judging' ? '심사 중'
    : status === 'done' ? '심사 완료'
    : status === 'error' ? '오류'
    : `${count}건 제출`;

  function handleHoverEnter() {
    clearTimeout(hoverTimerRef.current);
    if (count === 0) return;
    hoverTimerRef.current = setTimeout(() => setHoverOpen(true), 150);
  }
  function handleHoverLeave() {
    clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setHoverOpen(false), 120);
  }
  // 모바일 터치 — hover 개념 없어 탭으로 토글. 바깥 클릭은 onBlur로 처리(focus 시 open).
  function handleToggleClick(e) {
    e.stopPropagation();
    if (count === 0) return;
    clearTimeout(hoverTimerRef.current);
    setHoverOpen((prev) => !prev);
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 flex items-center gap-3"
      >
        <div className="flex items-center gap-1.5 shrink-0">
          <Pin size={13} className="text-amber-500" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">상시 과제</span>
        </div>
        <div
          className="flex-1 min-w-0 relative"
          onMouseEnter={handleHoverEnter}
          onMouseLeave={handleHoverLeave}
          onFocus={handleHoverEnter}
          onBlur={handleHoverLeave}
        >
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{question.title}</p>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            <button
              type="button"
              tabIndex={count > 0 ? 0 : -1}
              aria-haspopup="dialog"
              aria-expanded={hoverOpen}
              onClick={handleToggleClick}
              className={`inline-flex items-center gap-0.5 rounded ${count > 0 ? 'cursor-pointer hover:text-slate-700 dark:hover:text-slate-200' : ''} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40`}
            >
              <Users size={10} /> {count}{count > 0 ? '명 제출' : '명'}
            </button>
            <span>·</span>
            <span>{statusLabel}</span>
          </div>

          {/* 제출자 목록 팝오버 — hover/focus 시 */}
          <AnimatePresence>
            {hoverOpen && count > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                role="dialog"
                aria-label="제출자 목록"
                className="absolute left-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] z-30 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg overflow-hidden"
              >
                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                  <Users size={13} className="text-slate-400" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">제출자 {count}명</span>
                </div>
                <ul className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60">
                  {submissions.map((s) => (
                    <li key={s.id} className="px-4 py-2.5 flex items-center gap-3">
                      {s.imageUrl ? (
                        <img src={s.imageUrl} alt={`${s.name || '제출자'} 제출물`} loading="lazy" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                          {s.code ? <Code2 size={14} className="text-slate-500" /> : <span className="text-[11px] font-bold text-slate-500">{(s.name || '?').charAt(0)}</span>}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">{s.name}</p>
                        {s.title && <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{s.title}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {s.code && (
                          <span className="text-[9px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full" title="HTML 코드 제출">
                            CODE
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!isActive && onActivateQuestion && (
            <Button
              onClick={() => onActivateQuestion(assignmentId)}
              variant="secondary"
              size="sm"
              aria-label="상시 과제 활성화 — 심사 패널을 엽니다"
            >
              <Lightbulb size={13} /> 심사 화면으로
            </Button>
          )}
          <button
            onClick={() => setConfirmOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[32px] text-[11px] font-medium text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
            aria-label="상시 과제 종료"
          >
            <PinOff size={12} /> 종료
          </button>
        </div>
      </motion.div>

      <ConfirmModal
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => { clearAssignment(); setConfirmOpen(false); }}
        title="상시 과제를 종료할까요?"
        description="학생 화면에서 제출 폼이 사라집니다. 지금까지 받은 제출은 그대로 유지됩니다."
        confirmLabel="종료"
        variant="danger"
      />
    </>
  );
});
