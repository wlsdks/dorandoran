import { ref, set, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { getParticipantId, getNickname } from '@/lib/participant';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { createPortal } from 'react-dom';
import Button from '@/components/ui/Button';
import { useState, useCallback, useEffect, useMemo, memo } from 'react';
import { DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { useMyVote } from '@/hooks/useMyVote';
import VoteConfirm from './VoteConfirm';
import VoteErrorToast from './VoteErrorToast';

/**
 * Deterministic shuffle based on questionId + participantId.
 * Produces a consistent order per student so refreshes don't reshuffle.
 */
function shuffleWithSeed(items, seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  const arr = items.map((item, i) => ({ item, i }));
  for (let i = arr.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    const j = h % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.map((a) => a.i);
}

function SortableRankItem({ id, label, position, total, disabled, onMove }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }}
      className={`rounded-xl border bg-white dark:bg-slate-800 px-3 py-2 ${isDragging ? 'shadow-lg border-slate-300' : 'border-slate-200 dark:border-slate-700'}`}>
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-500 dark:text-slate-300 shrink-0 tabular-nums">{position}</span>
        <span className="flex-1 min-w-0 break-words text-base font-medium text-slate-800 dark:text-slate-200 leading-snug">{label}</span>
        <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} disabled={disabled} aria-label={`${label} 순서 끌어서 변경`} className="w-12 h-12 shrink-0 flex items-center justify-center rounded-lg text-slate-400 touch-none cursor-grab disabled:opacity-40"><GripVertical size={20} /></button>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-700 mt-1">
        <button type="button" onClick={() => onMove(position - 1, -1)} disabled={disabled || position === 1} aria-label={`${label} 위로 이동`} className="min-h-12 px-3 flex items-center justify-center gap-1 rounded-lg text-sm font-medium border border-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"><ArrowUp size={20} />위로</button>
        <button type="button" onClick={() => onMove(position - 1, 1)} disabled={disabled || position === total} aria-label={`${label} 아래로 이동`} className="min-h-12 px-3 flex items-center justify-center gap-1 rounded-lg text-sm font-medium border border-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"><ArrowDown size={20} />아래로</button>
      </div>
    </div>
  );
}

export default memo(function RankingVoter({ sessionId, questionId, options = [], disabled = false }) {
  const reducedMotion = useReducedMotion();
  const pid = getParticipantId();

  // Shuffle items deterministically per student
  const initialOrder = useMemo(() => {
    const seed = `${questionId}-${pid}`;
    return shuffleWithSeed(options, seed);
  }, [questionId, options, pid]);

  const { myVote } = useMyVote(sessionId, questionId);
  const [order, setOrder] = useState(initialOrder);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (myVote && !submitted) setSubmitted(true);
  }, [myVote, submitted]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    // 키보드 접근성 — 드래그 불가 사용자도 순위 변경 가능(Space로 집고 화살표로 이동)
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortableIds = useMemo(() => order.map((idx) => `rank-${idx}`), [order]);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = sortableIds.indexOf(active.id);
    const newIdx = sortableIds.indexOf(over.id);
    setOrder((prev) => arrayMove(prev, oldIdx, newIdx));
  }, [sortableIds]);

  const handleSubmit = useCallback(async () => {
    if (disabled || submitting) return;
    setSubmitting(true);
    try {
      await set(ref(db, `sessions/${sessionId}/questions/${questionId}/votes/${pid}`), {
        value: order.join(','),
        nickname: getNickname() || '익명',
        timestamp: serverTimestamp(),
      });
      setSubmitted(true);
    } catch (err) {
      logger.error('Ranking vote failed:', err);
      setSubmitting(false);
      setError('순위 제출에 실패했습니다. 다시 시도해주세요.');
    }
  }, [sessionId, questionId, order, pid, disabled, submitting]);

  if (submitted) {
    const answerStr = order.map((idx, pos) => `${pos + 1}. ${options[idx]}`).join(' → ');
    return (
      <VoteConfirm
        submittedLabel="순위 제출 완료!"
        submittedDescription="나의 순위가 기록되었습니다"
        waitingLabel="결과를 기다리는 중..."
        waitingDescription="강사가 결과를 공개하면 표시됩니다"
        selectedAnswer={answerStr}
        selectedAnswerLabel="내 순서"
      />
    );
  }

  return (
    <div className="space-y-3">
    <AnimatePresence>
      {error && <VoteErrorToast message={error} />}
    </AnimatePresence>
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="w-full rounded-xl bg-white dark:bg-slate-800 p-4 shadow-sm space-y-4"
    >
      <p className="text-sm text-slate-500 dark:text-slate-300 text-center leading-relaxed [word-break:keep-all]">
        1번부터 차례대로 맞춰주세요. 손잡이를 끌거나 위·아래 버튼으로 순서를 바꿀 수 있어요.
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {order.map((idx, pos) => (
              <SortableRankItem
                key={`rank-${idx}`}
                id={`rank-${idx}`}
                label={options[idx]}
                position={pos + 1}
                total={order.length}
                disabled={disabled || submitting}
                onMove={(index, direction) => setOrder(previous => arrayMove(previous, index, index + direction))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {createPortal(
        <div className="mobile-learning-tools fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 px-4 py-3 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-700">
          <div className="max-w-xl mx-auto">
            <Button type="button" onClick={handleSubmit} disabled={disabled || submitting} className="w-full min-h-12" aria-label="현재 순서로 순위 제출">
              {submitting ? '제출 중...' : '이 순서로 제출'}
            </Button>
          </div>
        </div>, document.body
      )}
    </motion.div>
    </div>
  );
})
