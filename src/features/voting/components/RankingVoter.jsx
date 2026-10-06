import { useVoteAcknowledgement } from '@/hooks/useVoteAcknowledgement';
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
import { GripVertical, ArrowUp, ArrowDown, Check, X } from 'lucide-react';
import { useMyVote } from '@/hooks/useMyVote';
import VoteConfirm from './VoteConfirm';
import VoteErrorToast from './VoteErrorToast';
import { shuffleWithSeed } from '@/lib/ranking-order';

// 학생마다(questionId + participantId) 고정된 순서로 섞는다 — 새로고침해도 바뀌지 않는다.

function SortableRankItem({ id, label, position, total, disabled, onMove }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }}
      className={`rounded-xl border bg-white dark:bg-slate-800 pl-3 pr-1.5 py-1.5 ${isDragging ? 'shadow-lg border-slate-300' : 'border-slate-200 dark:border-slate-700'}`}>
      {/* 한 줄 배치 — 위/아래 버튼을 따로 한 줄에 두면 카드가 두 배로 길어져 4개도 한 화면에 안 들어간다 */}
      <div className="flex items-center gap-1.5">
        <span className="w-10 shrink-0 text-center text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">{position}위</span>
        <span className="flex-1 min-w-0 pl-1 [word-break:keep-all] [overflow-wrap:anywhere] text-base font-medium text-slate-800 dark:text-slate-200 leading-snug">{label}</span>
        <button type="button" onClick={() => onMove(position - 1, -1)} disabled={disabled || position === 1} aria-label={`${label} 위로 이동`} className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-[0.94] disabled:opacity-25 disabled:cursor-not-allowed"><ArrowUp size={20} /></button>
        <button type="button" onClick={() => onMove(position - 1, 1)} disabled={disabled || position === total} aria-label={`${label} 아래로 이동`} className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-[0.94] disabled:opacity-25 disabled:cursor-not-allowed"><ArrowDown size={20} /></button>
        <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} disabled={disabled} aria-label={`${label} 순서 끌어서 변경`} className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg text-slate-400 touch-none cursor-grab disabled:opacity-40"><GripVertical size={20} /></button>
      </div>
    </div>
  );
}

export default memo(function RankingVoter({ sessionId, questionId, options = [], disabled = false, revealed = false }) {
  const reducedMotion = useReducedMotion();
  const pid = getParticipantId();

  // Shuffle items deterministically per student
  const initialOrder = useMemo(() => {
    const seed = `${questionId}-${pid}`;
    return shuffleWithSeed(options, seed);
  }, [questionId, options, pid]);


  const { myVote } = useMyVote(sessionId, questionId);
  const { begin, finish, canRestore } = useVoteAcknowledgement(`${sessionId}:${questionId}`);
  const [order, setOrder] = useState(initialOrder);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const savedOrder = useMemo(() => {
    if (myVote == null) return null;
    const parts = String(myVote).split(',');
    if (!parts.every(part => /^\d+$/.test(part))) return null;
    const candidate = parts.map(Number);
    return candidate.length === options.length && new Set(candidate).size === options.length
      && candidate.every(index => Number.isInteger(index) && index >= 0 && index < options.length)
      ? candidate : null;
  }, [myVote, options.length]);
  const invalidSavedOrder = myVote != null && !savedOrder;

  useEffect(() => {
    if (canRestore() && savedOrder && !submitted) {
      setOrder(savedOrder);
      setSubmitted(true);
    }
  }, [savedOrder, submitted, canRestore]);

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
    const token = begin(); if (token === null) return;
    setSubmitting(true);
    try {
      await set(ref(db, `sessions/${sessionId}/questions/${questionId}/votes/${pid}`), {
        value: order.join(','),
        nickname: getNickname() || '익명',
        timestamp: serverTimestamp(),
      });
      if (!finish(token)) return;
      setSubmitted(true);
    } catch (err) {
      if (!finish(token)) return;
      setSubmitted(false);
      logger.error('Ranking vote failed:', err);
      setSubmitting(false);
      setError('순위 제출에 실패했습니다. 다시 시도해주세요.');
    }
  }, [sessionId, questionId, order, pid, disabled, submitting, begin, finish]);

  // 정답 공개 후: 정답 순서와 내 순서를 자리별로 나란히 비교한다(정답은 저장 순서 0,1,2…).
  if (revealed) {
    const mine = submitted || savedOrder ? (savedOrder || order) : null;
    const hits = mine ? mine.filter((idx, pos) => idx === pos).length : 0;
    return (
      <div className="w-full rounded-xl bg-white dark:bg-slate-800 p-4 shadow-sm space-y-3">
        {/* 순서가 전부 맞아야 정답. 자리별 결과는 참고로만 보여준다. */}
        {mine ? (
          <div className="text-center space-y-1">
            <p className={`text-xl font-bold ${hits === options.length ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-900 dark:text-slate-100'}`}>
              {hits === options.length ? '정답! 순서를 모두 맞혔어요' : '아쉬워요, 오답이에요'}
            </p>
            {hits < options.length && <p className="text-sm text-slate-500 dark:text-slate-400 tabular-nums">순서를 모두 맞혀야 정답이에요 · {options.length}개 중 {hits}개 자리는 맞았어요</p>}
          </div>
        ) : <p className="text-center text-sm text-slate-600 dark:text-slate-300">제출하지 않았어요. 정답 순서를 확인해보세요</p>}
        <ol className="space-y-2">
          {options.map((item, pos) => {
            const ok = mine ? mine[pos] === pos : null;
            return (
              <li key={pos} data-ranking-hit={ok || undefined} style={ok ? { '--hit-delay': `${pos * 110}ms` } : undefined}
                className={`relative overflow-hidden rounded-xl border px-3 py-2.5 ${ok ? 'ranking-hit border-indigo-300 bg-indigo-50/60 dark:border-indigo-400/60 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-slate-700'}`}>
                <div className="flex items-center gap-2">
                  <span className="w-10 shrink-0 text-center text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">{pos + 1}위</span>
                  <span className="flex-1 min-w-0 text-base font-semibold text-slate-900 dark:text-slate-100 [word-break:keep-all]">{item}</span>
                  {ok !== null && (ok ? <Check size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="맞음" /> : <X size={18} className="shrink-0 text-red-500" aria-label="틀림" />)}
                </div>
                {ok === false && <p className="mt-1 pl-12 text-xs text-slate-500 dark:text-slate-400 [word-break:keep-all]">내 답: {options[mine[pos]]}</p>}
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  if (submitted) {
    const answerStr = order.map((idx, pos) => `${pos + 1}위 ${options[idx]}`).join(' → ');
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
    {invalidSavedOrder && <p role="alert" className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-200">저장된 순서를 확인할 수 없어요. 순서를 다시 선택하고 제출해주세요.</p>}
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
        맨 위가 1위예요. 화살표나 오른쪽 손잡이를 끌어 순서를 바꾸세요.
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
