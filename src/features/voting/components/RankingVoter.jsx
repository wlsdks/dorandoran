import { useVoteAcknowledgement } from '@/hooks/useVoteAcknowledgement';
import { ref, set, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { getParticipantId, getNickname } from '@/lib/participant';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { rise, spring } from '@/lib/motion';
import { createPortal } from 'react-dom';
import Button from '@/components/ui/Button';
import NumberBadge from '@/components/ui/NumberBadge';
import { useState, useCallback, useEffect, useMemo, memo } from 'react';
import { DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ArrowUp, ArrowDown, ArrowRight, Check, X } from 'lucide-react';
import { useMyVote } from '@/hooks/useMyVote';
import VoteConfirm from './VoteConfirm';
import VoteErrorToast from './VoteErrorToast';
import { shuffleWithSeed } from '@/lib/ranking-order';
import { correctRankingOrder, formatRankingSequence, parseRankingOrder, rankingOrdinal, rankingPositionHits } from '@/lib/ranking-answer';

// 항목 번호(①②③…)는 강사가 정한 고정 이름표다. 학생은 번호 카드를 정답 순서대로 놓고, 투표 값은 그 번호 순서다.
// 학생마다(questionId + participantId) 고정된 순서로 섞는다 — 새로고침해도 바뀌지 않는다.

function SortableRankItem({ id, index, label, position, total, disabled, onMove }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const name = `${index + 1}번 ${label}`;
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }}
      className={`rounded-xl border bg-white dark:bg-slate-800 pl-2.5 pr-1.5 py-1.5 ${isDragging ? 'shadow-lg border-slate-300' : 'border-slate-200 dark:border-slate-700'}`}>
      {/* 한 줄 배치 — 위/아래 버튼을 따로 한 줄에 두면 카드가 두 배로 길어져 4개도 한 화면에 안 들어간다 */}
      <div className="flex items-center gap-2">
        <NumberBadge number={index + 1} size="lg" label={`${index + 1}번`} />
        <span className="flex-1 min-w-0 [word-break:keep-all] [overflow-wrap:anywhere] text-base font-medium text-slate-800 dark:text-slate-200 leading-snug">{label}</span>
        <button type="button" onClick={() => onMove(position - 1, -1)} disabled={disabled || position === 1} aria-label={`${name} 위로 이동`} className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-[0.94] disabled:opacity-25 disabled:cursor-not-allowed"><ArrowUp size={20} /></button>
        <button type="button" onClick={() => onMove(position - 1, 1)} disabled={disabled || position === total} aria-label={`${name} 아래로 이동`} className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-[0.94] disabled:opacity-25 disabled:cursor-not-allowed"><ArrowDown size={20} /></button>
        <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} disabled={disabled} aria-label={`${name} 순서 끌어서 변경`} className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg text-slate-400 touch-none cursor-grab disabled:opacity-40"><GripVertical size={20} /></button>
      </div>
    </div>
  );
}

/** "정답 ① → ③ → ④ → ②" 같은 번호 순서 한 줄. */
function SequenceChips({ label, order, options, strong = false }) {
  return (
    <div className="flex items-center gap-2 min-w-0" aria-label={`${label} ${formatRankingSequence(order, { options })}`}>
      <span className="w-10 shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
      <ol className="flex flex-wrap items-center gap-1" aria-hidden="true">
        {order.map((index, position) => (
          <li key={position} className="flex items-center gap-1">
            {position > 0 && <ArrowRight size={12} className="text-slate-300 dark:text-slate-600" />}
            <NumberBadge number={index + 1} size="md" tone={strong ? 'solid' : 'outline'} />
          </li>
        ))}
      </ol>
    </div>
  );
}

export default memo(function RankingVoter({ sessionId, questionId, options = [], correctAnswer, disabled = false, revealed = false }) {
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

  const savedOrder = useMemo(() => (myVote == null ? null : parseRankingOrder(String(myVote), options.length)), [myVote, options.length]);
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

  // 정답 공개 후: 정답 번호 순서와 내 순서를 나란히 두고, 자리별로 맞았는지 보여준다. 순서가 전부 같아야 정답이다.
  if (revealed) {
    const correct = correctRankingOrder(options, correctAnswer);
    const mine = submitted || savedOrder ? (savedOrder || order) : null;
    const hits = rankingPositionHits(correct, mine);
    const hitCount = hits.filter(Boolean).length;
    const perfect = mine !== null && hitCount === options.length;
    return (
      <div className="w-full rounded-xl bg-white dark:bg-slate-800 p-4 shadow-sm space-y-4" data-ranking-result={mine ? (perfect ? 'correct' : 'wrong') : 'none'}>
        {mine ? (
          <div className="text-center space-y-1">
            <p className={`text-xl font-bold ${perfect ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-900 dark:text-slate-100'}`}>
              {perfect ? '정답! 순서를 모두 맞혔어요' : '아쉬워요, 오답이에요'}
            </p>
            {!perfect && <p className="text-sm text-slate-500 dark:text-slate-400 tabular-nums">순서를 모두 맞혀야 정답이에요 · {options.length}개 중 {hitCount}개 자리는 맞았어요</p>}
          </div>
        ) : <p className="text-center text-sm text-slate-600 dark:text-slate-300">제출하지 않았어요. 정답 순서를 확인해보세요</p>}
        <div className="space-y-2 rounded-lg bg-slate-50 dark:bg-slate-900/40 px-3 py-2.5">
          <SequenceChips label="정답" order={correct} options={options} strong />
          {mine && <SequenceChips label="내 답" order={mine} options={options} />}
        </div>
        <ol className="space-y-2">
          {correct.map((itemIndex, pos) => {
            const ok = hits[pos];
            return (
              <li key={pos} data-ranking-hit={ok || undefined} style={ok ? { '--hit-delay': `${pos * 110}ms` } : undefined}
                className={`relative overflow-hidden rounded-xl border px-3 py-2.5 ${ok ? 'ranking-hit border-indigo-300 bg-indigo-50/60 dark:border-indigo-400/60 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-slate-700'}`}>
                <div className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400 [word-break:keep-all]">{rankingOrdinal(pos)}</span>
                  <NumberBadge number={itemIndex + 1} size="md" label={`${itemIndex + 1}번`} />
                  <span className="flex-1 min-w-0 text-base font-semibold text-slate-900 dark:text-slate-100 [word-break:keep-all]">{options[itemIndex]}</span>
                  {ok !== null && (ok ? <Check size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="맞음" /> : <X size={18} className="shrink-0 text-red-500" aria-label="틀림" />)}
                </div>
                {ok === false && <p className="mt-1 pl-14 text-xs text-slate-500 dark:text-slate-400 [word-break:keep-all]">내 답: {mine[pos] + 1}번 {options[mine[pos]]}</p>}
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  if (submitted) {
    return (
      <VoteConfirm
        submittedLabel="순위 제출 완료!"
        submittedDescription="나의 순서가 기록되었습니다"
        waitingLabel="결과를 기다리는 중..."
        waitingDescription="강사가 결과를 공개하면 표시됩니다"
        selectedAnswer={formatRankingSequence(order, { circled: true, options })}
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
      transition={spring.default}
      className="w-full rounded-xl bg-white dark:bg-slate-800 p-4 shadow-sm space-y-4"
    >
      <p className="text-sm text-slate-500 dark:text-slate-300 text-center leading-relaxed [word-break:keep-all]">
        맨 위가 첫 번째예요. 번호는 항목 이름표이니, 화살표나 손잡이로 정답 순서대로 놓으세요.
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {order.map((idx, pos) => (
              <SortableRankItem
                key={`rank-${idx}`}
                id={`rank-${idx}`}
                index={idx}
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
        <motion.div initial={rise.initial} animate={rise.animate} transition={{ ...rise.transition, delay: 0.1 }} className="mobile-learning-tools fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 px-4 py-3 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-700">
          <div className="max-w-xl mx-auto">
            <Button type="button" onClick={handleSubmit} disabled={disabled || submitting} className="w-full min-h-12" aria-label="현재 순서로 순위 제출">
              {submitting ? '제출 중...' : '이 순서로 제출'}
            </Button>
          </div>
        </motion.div>, document.body
      )}
    </motion.div>
    </div>
  );
})
