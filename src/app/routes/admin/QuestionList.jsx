import { useState, useEffect, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import Toast from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';
import { ChevronDown } from 'lucide-react';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import { QuestionItemContent, SortableItem } from './QuestionItem';
import ConfirmModal from '@/components/ui/ConfirmModal';

/** Detect mobile once for DnD gating (no drag on mobile). */
function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const handler = (e) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return mobile;
}

// dnd-kit 기본 낭독 문구는 영어라 한국어로 바꾼다.
const dragAnnouncements = {
  onDragStart: () => '문항을 집었어요.',
  onDragOver: ({ over }) => (over ? '다른 문항 위로 옮기는 중이에요.' : '목록 밖이에요.'),
  onDragEnd: ({ over }) => (over ? '문항 순서를 바꿨어요.' : '문항을 제자리에 놓았어요.'),
  onDragCancel: () => '순서 바꾸기를 취소했어요.',
};

export default memo(function QuestionList({
  questionList, currentQuestion, onActivate, onReveal, onRevealAnswer, onShowLeaderboard, onClearActive,
  onEdit, onDuplicate, onDelete, onReset, readOnly = false, onView, onReorder, onSaveToLibrary,
  persistentAssignmentId, onTogglePersistent, onMoveUp, onMoveDown,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { toast, showToast } = useToast();
  const isMobile = useIsMobile();
  const activeCount = questionList.filter(([qId]) => qId === currentQuestion).length;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const ids = questionList.map(([qId]) => qId);

  const handleDuplicateWithToast = useCallback((id) => { onDuplicate(id); showToast('질문이 복제되었습니다'); }, [onDuplicate, showToast]);
  // 응답이 있는 질문은 실수 삭제 방지 — 확인 모달. 응답 없으면 즉시 삭제.
  const [pendingDelete, setPendingDelete] = useState(null);
  const requestDelete = useCallback((id) => {
    const entry = questionList.find(([qId]) => qId === id);
    const voteCount = entry ? Object.keys(entry[1]?.votes || {}).length : 0;
    if (voteCount > 0) { setPendingDelete({ id, voteCount }); return; }
    onDelete(id); showToast('질문이 삭제되었습니다');
  }, [questionList, onDelete, showToast]);
  const confirmDelete = useCallback(() => {
    if (pendingDelete) { onDelete(pendingDelete.id); showToast('질문이 삭제되었습니다'); }
    setPendingDelete(null);
  }, [pendingDelete, onDelete, showToast]);
  // 개별 질문 응답만 초기화 — 전체 초기화 없이 이 질문 응답/공개상태만 리셋(확인 필요).
  const [pendingReset, setPendingReset] = useState(null);
  const requestReset = useCallback((id) => {
    const entry = questionList.find(([qId]) => qId === id);
    const voteCount = entry ? Object.keys(entry[1]?.votes || {}).length : 0;
    setPendingReset({ id, voteCount });
  }, [questionList]);
  const confirmReset = useCallback(() => {
    if (pendingReset) { onReset?.(pendingReset.id); showToast('이 질문의 응답을 초기화했습니다'); }
    setPendingReset(null);
  }, [pendingReset, onReset, showToast]);
  const handleSaveWithToast = useCallback((id) => { onSaveToLibrary?.(id); showToast('보관함에 저장되었습니다'); }, [onSaveToLibrary, showToast]);

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder) return;
    onReorder(active.id, over.id);
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 text-left bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200/60 dark:active:bg-slate-600 transition-colors duration-150"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">추가된 문항 {questionList.length}개</span>
          {activeCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-slate-700 dark:bg-slate-300 animate-pulse" />}
        </div>
        <motion.div animate={{ rotate: collapsed ? 0 : 180 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={14} className="text-slate-400" />
        </motion.div>
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="p-2 space-y-2">
              {!readOnly && questionList.length > 1 && !isMobile ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} accessibility={{ announcements: dragAnnouncements, screenReaderInstructions: { draggable: '스페이스로 문항을 집고 위·아래 화살표로 옮긴 뒤 스페이스로 놓으세요. Esc로 취소합니다.' } }}>
                  <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                    {questionList.map(([qId, q], index) => (
                      <SortableItem
                        key={qId} qId={qId} q={q} currentQuestion={currentQuestion} readOnly={readOnly}
                        onActivate={onActivate} onReveal={onReveal} onRevealAnswer={onRevealAnswer} onShowLeaderboard={onShowLeaderboard}
                        onClearActive={onClearActive} onEdit={onEdit}
                        onDuplicate={handleDuplicateWithToast}
                        onDelete={requestDelete}
                        onReset={!readOnly && onReset ? requestReset : null}
                        onSaveToLibrary={onSaveToLibrary ? handleSaveWithToast : null}
                        isPersistent={persistentAssignmentId === qId}
                        onTogglePersistent={onTogglePersistent}
                        onMoveUp={index > 0 ? onMoveUp : null}
                        onMoveDown={index < questionList.length - 1 ? onMoveDown : null}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              ) : (
                questionList.map(([qId, q], index) => (
                  <QuestionItemContent
                    key={qId} qId={qId} q={q} currentQuestion={currentQuestion} readOnly={readOnly}
                    onView={onView} onActivate={onActivate} onReveal={onReveal} onRevealAnswer={onRevealAnswer} onShowLeaderboard={onShowLeaderboard}
                    onClearActive={onClearActive} onEdit={onEdit}
                    onDuplicate={handleDuplicateWithToast}
                    onDelete={requestDelete}
                    onReset={!readOnly && onReset ? requestReset : null}
                    onSaveToLibrary={onSaveToLibrary ? handleSaveWithToast : null}
                    isPersistent={persistentAssignmentId === qId}
                    onTogglePersistent={onTogglePersistent}
                    onMoveUp={!readOnly && index > 0 ? onMoveUp : null}
                    onMoveDown={!readOnly && index < questionList.length - 1 ? onMoveDown : null}
                  />
                ))
              )}

              {questionList.length === 0 && (
                <div className="flex flex-col items-center text-center py-6 space-y-2">
                  <DoranDoranMascot size="sm" mood="waiting" />
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">아직 질문이 없습니다</p>
                  <p className="text-slate-400 dark:text-slate-500 text-xs">위의 + 추가 버튼으로 첫 질문을 만들어보세요</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toast message={toast} raised />

      <ConfirmModal
        open={!!pendingDelete}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
        title="이 질문을 삭제할까요?"
        description={pendingDelete ? `이미 ${pendingDelete.voteCount}명이 응답했습니다. 삭제하면 응답 데이터도 함께 사라지며 되돌릴 수 없어요.` : ''}
        confirmLabel="삭제"
        cancelLabel="취소"
        variant="danger"
      />

      <ConfirmModal
        open={!!pendingReset}
        onConfirm={confirmReset}
        onCancel={() => setPendingReset(null)}
        title="이 질문만 초기화할까요?"
        description={pendingReset ? `이 질문의 응답 ${pendingReset.voteCount}건과 정답 공개 상태, 이 질문으로 받은 퀴즈 점수가 지워집니다. 다른 질문의 점수는 그대로예요.` : ''}
        confirmLabel="초기화"
        cancelLabel="취소"
        variant="primary"
      />
    </div>
  );
});
