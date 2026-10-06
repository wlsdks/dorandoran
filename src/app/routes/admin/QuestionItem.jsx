import { memo, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { list, popIn, settle } from '@/lib/motion';
import Tooltip from '@/components/ui/Tooltip';
import { GripVertical, BookmarkPlus, Check, Copy, MessageSquare, Pencil, Play, Square, Trash2, Trophy, Loader2, Pin, PinOff, RotateCcw, MoreHorizontal, ArrowUp, ArrowDown, Timer } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { isQuizQuestion } from '@/lib/quiz';
import { QUESTION_TYPES } from '@/lib/question-types';
import { formatTimeLimit } from '@/lib/question-timer';
import { MODE_CARD_TYPE, SPECIAL_MODES } from '@/lib/modes';

const primaryBtnClass = 'min-h-11 min-w-11 flex items-center justify-center p-2 rounded-lg sm:rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 text-white transition-colors duration-150 active:scale-90';
const stopBtnClass = 'min-h-11 min-w-11 flex items-center justify-center p-2 rounded-lg sm:rounded-md bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors duration-150 active:scale-90';

/** Button with brief loading feedback to prevent double-clicks. */
function ActionButton({ onClick, className, children, 'aria-label': ariaLabel, feedbackMs = 600 }) {
  const [busy, setBusy] = useState(false);
  const handle = useCallback(() => {
    if (busy) return;
    setBusy(true);
    onClick?.();
  }, [busy, onClick]);
  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => setBusy(false), feedbackMs);
    return () => clearTimeout(t);
  }, [busy, feedbackMs]);
  return (
    <button onClick={handle} className={className} aria-label={ariaLabel} disabled={busy}>
      {busy ? <Loader2 size={typeof children?.props?.size === 'number' ? children.props.size : 14} className="animate-spin" /> : children}
    </button>
  );
}

/** Shared question item UI — used both sortable (desktop) and static (mobile/readOnly). */
export function QuestionItemContent({ qId, q, currentQuestion, readOnly, onView, onActivate, onReveal, onRevealAnswer, onShowLeaderboard, onClearActive, onEdit, onDuplicate, onDelete, onReset, onSaveToLibrary, isPersistent = false, onTogglePersistent, onMoveUp = null, onMoveDown = null, isDragging = false, dragProps = {} }) {
  const hasVotes = Object.keys(q?.votes || {}).length > 0;
  // 모드 카드는 질문이 아니라 화면 전환 항목이다 — 라벨·아이콘을 모드 목록에서 가져온다
  const isModeCard = q.type === MODE_CARD_TYPE;
  const modeMeta = isModeCard ? SPECIAL_MODES.find((m) => m.mode === q.mode) : null;
  const qType = isModeCard
    ? { label: modeMeta ? `${modeMeta.label} 화면` : '화면 전환', icon: modeMeta?.icon }
    : QUESTION_TYPES.find((t) => t.value === q.type);
  const Icon = qType?.icon || MessageSquare;
  const isActive = currentQuestion === qId;
  const isQuiz = !isModeCard && isQuizQuestion(q);
  const hasAnswer = !isQuiz && (q.correctAnswer || q.type === 'ranking');
  const hasReveal = isQuiz || hasAnswer;
  const isAiJudge = q.type === 'aiJudge';
  // 모드 카드는 답변·정답·보관함 개념이 없다 — 해당 버튼을 감춘다
  const handleReveal = () => isQuiz ? onReveal?.(qId) : onRevealAnswer?.(qId);
  const stopDrag = (e) => e.stopPropagation();

  return (
    <div
      {...dragProps}
      onClick={readOnly && onView ? () => onView(qId) : undefined}
      className={`p-4 sm:p-3.5 rounded-xl border transition-[color,background-color,border-color,box-shadow] duration-200 group ${
        isDragging ? 'shadow-lg opacity-80 scale-[1.03] bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-500 cursor-grabbing touch-none' :
        readOnly
          ? `bg-white dark:bg-slate-800 ${currentQuestion === qId ? 'border-slate-400 dark:border-slate-500 shadow-sm' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer'}`
          : isActive ? 'bg-white dark:bg-slate-800 border-indigo-400 ring-1 ring-indigo-400/60 dark:border-indigo-400/80 shadow-sm sm:cursor-grab' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 sm:cursor-grab'
      }`}
    >
      <div className="flex items-start gap-2">
        {/* Drag indicator — desktop only */}
        {!readOnly && (
          <div className="shrink-0 -ml-1 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-500 transition-colors duration-150 pt-0.5 cursor-grab active:cursor-grabbing max-sm:hidden">
            <GripVertical size={14} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5 sm:mb-1">
            <Icon size={13} className={`shrink-0 ${!readOnly && isActive ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`} />
            <span className={`text-xs font-semibold whitespace-nowrap ${!readOnly && isActive ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
              {qType?.label}
            </span>
            {!readOnly && isActive && <motion.span initial={popIn.initial} animate={popIn.animate} transition={popIn.transition} className="inline-flex"><Badge variant="primary">LIVE</Badge></motion.span>}
            {q.timerDuration > 0 && <span className="inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums text-slate-500 dark:text-slate-400" title="시간 제한"><Timer size={11} aria-hidden="true" />{formatTimeLimit(q.timerDuration)}</span>}
            {!readOnly && isPersistent && (
              <Badge variant="neutral">
                <Pin size={10} className="mr-0.5" /> 상시 과제
              </Badge>
            )}
            {isQuiz && q.betting && <Badge variant="neutral">베팅</Badge>}
            {isQuiz && q.event && <Badge variant="neutral">{q.event.label || '이벤트'}</Badge>}
            {hasReveal && q.revealedAt && <Badge variant="neutral">정답 공개</Badge>}
          </div>
          <span className="block line-clamp-3 text-slate-700 dark:text-slate-200 text-[15px] sm:text-sm leading-snug break-keep [overflow-wrap:anywhere]" title={q.title}>{q.title}</span>
          {readOnly && q.votes && (
            <span className="text-slate-400 text-xs ml-1">({Object.keys(q.votes).length}명 응답)</span>
          )}
        </div>

        {/* Desktop: compact buttons */}
        {!readOnly && (
          <div className="hidden sm:flex gap-1 shrink-0" onPointerDown={stopDrag}>
            {!isActive ? (
              <Tooltip label={isModeCard ? '이 화면으로 전환' : '질문 활성화'}>
                <ActionButton onClick={() => onActivate(qId)} className={primaryBtnClass} aria-label={isModeCard ? '이 화면으로 전환' : '질문 활성화'}>
                  <Play size={18} />
                </ActionButton>
              </Tooltip>
            ) : (
              <>
                {hasReveal && !q.revealedAt && (
                  <Tooltip label="정답 공개"><ActionButton onClick={handleReveal} className={primaryBtnClass} aria-label="정답 공개">
                    <Check size={18} />
                  </ActionButton></Tooltip>
                )}
                {isQuiz && q.revealedAt && (
                  <Tooltip label="랭킹 보기"><ActionButton onClick={onShowLeaderboard} className={primaryBtnClass} aria-label="랭킹 보기">
                    <Trophy size={18} />
                  </ActionButton></Tooltip>
                )}
                <Tooltip label="질문 중지"><ActionButton onClick={onClearActive} className={stopBtnClass} aria-label="질문 중지">
                  <Square size={18} />
                </ActionButton></Tooltip>
              </>
            )}

          </div>
        )}
      </div>

      {!readOnly && <details className="mt-3 border-t border-slate-100 dark:border-slate-700 pt-1" onPointerDown={stopDrag}>
        <summary aria-label={`문항 관리: ${q.title}`} className="min-h-11 flex items-center justify-between cursor-pointer list-none text-sm text-slate-500 dark:text-slate-300 rounded-lg px-2 hover:bg-slate-50 dark:hover:bg-slate-700">
          문항 관리 <MoreHorizontal size={20} />
        </summary>
        <div className="grid grid-cols-2 gap-1 pt-1">
          {[
            ...(isQuiz && q.revealedAt && !q.awardedAt ? [{ label: '점수 반영 다시 시도', icon: RotateCcw, action: () => onReveal?.(qId) }] : []),
            ...(onEdit && !isModeCard ? [{ label: '질문 수정', icon: Pencil, action: () => onEdit(qId) }] : []),
            { label: '질문 복제', icon: Copy, action: () => onDuplicate(qId) },
            // 드래그 대신 쓸 수 있는 순서 이동(키보드·터치)
            ...(onMoveUp ? [{ label: '위로 이동', icon: ArrowUp, action: () => onMoveUp(qId) }] : []),
            ...(onMoveDown ? [{ label: '아래로 이동', icon: ArrowDown, action: () => onMoveDown(qId) }] : []),
            ...(onSaveToLibrary && !isModeCard ? [{ label: '보관함에 저장', icon: BookmarkPlus, action: () => onSaveToLibrary(qId) }] : []),
            ...(isAiJudge && onTogglePersistent ? [{ label: isPersistent ? '상시 과제 해제' : '상시 과제로 설정', icon: isPersistent ? PinOff : Pin, action: () => onTogglePersistent(qId) }] : []),
            ...(onReset && hasVotes ? [{ label: '응답 초기화', icon: RotateCcw, action: () => onReset(qId) }] : []),
            { label: '질문 삭제', icon: Trash2, action: () => onDelete(qId), danger: true },
          ].map(item => <button key={item.label} type="button" aria-label={item.label} onClick={event => { event.currentTarget.closest('details').open = false; item.action(); }} className={`min-h-11 flex items-center gap-2 rounded-lg px-2 text-sm text-left hover:bg-slate-100 dark:hover:bg-slate-700 ${item.danger ? 'text-red-600 dark:text-red-300' : 'text-slate-600 dark:text-slate-200'}`}>
            <item.icon size={18} className="shrink-0" />{item.label}
          </button>)}
        </div>
      </details>}

      {/* Mobile: action buttons row below content */}
      {!readOnly && (
        <div className="flex gap-2 mt-3 sm:hidden">
          {!isActive ? (
            <>
              <ActionButton onClick={() => onActivate(qId)} className={`flex-1 flex items-center justify-center gap-1.5 min-h-[48px] rounded-xl text-sm font-semibold active:scale-[0.96] ${primaryBtnClass}`} aria-label={isModeCard ? '이 화면으로 전환' : '질문 활성화'}>
                <Play size={16} /> 시작
              </ActionButton>
              {onEdit && (
                <button onClick={() => onEdit(qId)} className={`flex items-center justify-center gap-1.5 min-h-[48px] px-4 rounded-xl text-sm font-medium active:scale-[0.96] ${stopBtnClass}`} aria-label="질문 수정">
                  <Pencil size={16} />
                </button>
              )}
            </>
          ) : (
            <>
              {hasReveal && !q.revealedAt && (
                <ActionButton onClick={handleReveal} className={`flex-1 flex items-center justify-center gap-1.5 min-h-[48px] rounded-xl text-sm font-semibold active:scale-[0.96] ${primaryBtnClass}`} aria-label="정답 공개">
                  <Check size={16} /> 정답 공개
                </ActionButton>
              )}
              {isQuiz && q.revealedAt && (
                <ActionButton onClick={onShowLeaderboard} className={`flex-1 flex items-center justify-center gap-1.5 min-h-[48px] rounded-xl text-sm font-semibold active:scale-[0.96] ${primaryBtnClass}`} aria-label="랭킹">
                  <Trophy size={16} /> 랭킹
                </ActionButton>
              )}
              <ActionButton onClick={onClearActive} className={`flex-1 flex items-center justify-center gap-1.5 min-h-[48px] rounded-xl text-sm font-semibold active:scale-[0.96] ${stopBtnClass}`} aria-label="중지">
                <Square size={16} /> 중지
              </ActionButton>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export const SortableItem = memo(function SortableItem(props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.qId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  // 바깥 motion.div: 추가·삭제 등장/퇴장 + 순서가 바뀐 뒤 자리로 미끄러짐(layout).
  // 안쪽 div: dnd-kit이 끌기 중 transform을 직접 쓴다 — 둘을 한 요소에 두면 서로 덮어쓴다.
  return (
    <motion.div layout="position" variants={list.item} initial="initial" animate="animate" exit="exit" transition={settle}>
      <div ref={setNodeRef} style={style}>
        <QuestionItemContent {...props} isDragging={isDragging} dragProps={{ ...attributes, ...listeners, className: 'touch-none' }} />
      </div>
    </motion.div>
  );
});
