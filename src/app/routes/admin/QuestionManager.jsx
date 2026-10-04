import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookmarkPlus, PanelLeftClose, Plus, Eye, RotateCcw, Sparkles, Check, ChevronDown } from 'lucide-react';
import Button from '@/components/ui/Button';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Toast from '@/components/ui/Toast';
import { isQuizQuestion } from '@/lib/quiz';
import { useAdminKeyboardShortcuts } from '@/hooks/useAdminKeyboardShortcuts';
import { useQuestionLibrary } from '@/features/questions/api/useQuestionLibrary';
import { useQuestionActions } from '@/hooks/useQuestionActions';
import { usePersistentAssignment } from '@/features/ai-judge/api/useLiveJudging';
import { useHandRaises } from '@/features/hand-raise/api/useHandRaises';
import { useUrgentQuestions } from '@/features/questions/api/useUrgentQuestions';
import QuestionForm from './QuestionForm';
import QuestionList from './QuestionList';
import QuickProgressCard from './QuickProgressCard';
import ImportFromLibraryModal from './ImportFromLibraryModal';
import QuestionPreview from './QuestionPreview';
import AIQuestionGenerator from '@/features/questions/components/AIQuestionGenerator';
import { isGeneratorReady } from '@/features/questions/api/generateQuestions';

function TooltipIconButton({ onClick, label, children, hoverColor = 'hover:text-slate-600 dark:hover:text-slate-300', ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <button onClick={onClick} className={`min-h-11 min-w-11 flex items-center justify-center p-2 rounded-lg text-slate-400 dark:text-slate-500 ${hoverColor} hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-150 active:scale-90`} {...props}>
        {children}
      </button>
      <AnimatePresence>
        {show && (
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.1 }}
            className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[11px] font-medium rounded-md whitespace-nowrap z-50 pointer-events-none"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function QuestionManager({
  sessionId,
  questions,
  currentQuestion,
  scores = {},
  participants = {},
  onAddClick,
  onEditClick,
  onCollapse,
  readOnly = false,
  onViewQuestion,
  formOpen = false,
  adminUid,
  speedQuizActive = false,
  onStartSpeedQuiz,
  onEndSpeedQuiz,
  speedQuizCount = 0,
  modeSlot = null,
  modeButton = null,
  mobileStickyProgress = false,
}) {
  const [showForm, setShowForm] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetClearParticipants, setResetClearParticipants] = useState(false);
  const [aiGenOpen, setAiGenOpen] = useState(false);
  const { saveQuestion: saveToLibrary } = useQuestionLibrary(adminUid);
  const { assignmentId: persistentAssignmentId, setAssignment: setPersistent, clearAssignment: clearPersistent } = usePersistentAssignment(sessionId);
  // P2-2: 초기화 모달에 in-flight 데이터 양 표시 — staffChat은 staff DM만 wipe(공개 chat은 별도)
  const { count: handCount } = useHandRaises(sessionId);
  const { unreadCount: urgentUnreadCount } = useUrgentQuestions(sessionId);
  const inFlightLost = [
    handCount > 0 && `손든 학생 ${handCount}명`,
    urgentUnreadCount > 0 && `읽지 않은 긴급 질문 ${urgentUnreadCount}건`,
  ].filter(Boolean);
  const resetDescription = inFlightLost.length > 0
    ? `진행 중인 데이터가 함께 사라집니다:\n• ${inFlightLost.join('\n• ')}\n\n모든 답변·점수·참여 기록을 초기화할까요? 참여자는 재접속하면 다시 표시됩니다.`
    : '모든 답변, 점수, 참여 기록을 초기화할까요? 참여자는 재접속하면 다시 표시됩니다.';

  const {
    error, toast, questionList,
    handleSubmit, activateQuestion, clearActive,
    deleteQuestion, duplicateQuestion, moveQuestion, reorderQuestion, resetQuestion,
    importFromLibrary, revealQuiz, revealHint, revealAnswer, setSlide, resetAllQuestions, showLeaderboard,
  } = useQuestionActions(sessionId, questions, currentQuestion, scores, participants);

  const handleTogglePersistent = useCallback((qId) => {
    if (persistentAssignmentId === qId) clearPersistent();
    else setPersistent(qId);
  }, [persistentAssignmentId, setPersistent, clearPersistent]);

  const activeIndex = questionList.findIndex(([qId]) => qId === currentQuestion);
  const currentEntry = activeIndex >= 0 ? questionList[activeIndex] : null;
  const nextEntry = activeIndex >= 0 ? questionList[activeIndex + 1] : questionList[0];

  const completedCount = questionList.filter(([, q]) => q.activatedAt || q.revealedAt).length;
  const handleActivate = useCallback((qId) => activateQuestion(qId), [activateQuestion]);
  const handleNextEvent = useCallback(() => {}, []);

  async function handleSaveToLibrary(qId) {
    const question = questions?.[qId];
    if (!question || !adminUid) return;
    const { votes: _v, aiGrades: _ag, activatedAt: _a, revealedAt: _r, awardedAt: _aw, event: _e, order: _o, ...rest } = question;
    await saveToLibrary(rest);
  }

  // Keyboard shortcuts for quick session control
  const shortcutsEnabled = !readOnly && !formOpen && !showForm && questionList.length > 0;
  useAdminKeyboardShortcuts({
    enabled: shortcutsEnabled,
    questionList,
    currentQuestion,
    onActivate: handleActivate,
    onReveal: revealQuiz,
    onShowLeaderboard: showLeaderboard,
    onClearActive: clearActive,
    isQuizFn: isQuizQuestion,
  });

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{readOnly ? '질문 목록' : '수업 진행'}</h2>
          <div className="flex items-center gap-1">
            {questionList.length > 0 && (
              <TooltipIconButton onClick={() => setPreviewOpen(true)} label="미리보기" aria-label="문항 미리보기">
                <Eye size={18} />
              </TooltipIconButton>
            )}
            {!readOnly && onCollapse && (
              <TooltipIconButton onClick={onCollapse} label="접기" aria-label="사이드바 접기">
                <PanelLeftClose size={18} />
              </TooltipIconButton>
            )}
          </div>
        </div>
      </div>

      {questionList.length > 0 && !readOnly && (
        <div className={mobileStickyProgress ? 'sticky top-0 z-10 -mx-5 px-5 pt-3 pb-3 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 sm:static sm:mx-0 sm:px-0 sm:pt-0 sm:pb-0 sm:bg-transparent sm:border-none' : ''}>
          <QuickProgressCard
            questionList={questionList}
            activeIndex={activeIndex}
            currentEntry={currentEntry}
            nextEntry={nextEntry}
            onActivate={handleActivate}
            onClearActive={clearActive}
            onReveal={revealQuiz}
            onRevealHint={revealHint}
            onRevealAnswer={revealAnswer}
            onSlide={setSlide}
            onShowLeaderboard={showLeaderboard}
            onNextEvent={handleNextEvent}
            speedQuizActive={speedQuizActive}
            onStartSpeedQuiz={onStartSpeedQuiz}
            onEndSpeedQuiz={onEndSpeedQuiz}
            speedQuizCount={speedQuizCount}
          />
        </div>
      )}

      {questionList.length > 0 && readOnly && (
        <button
          onClick={() => onViewQuestion?.('__summary__')}
          className={`w-full rounded-xl border bg-white dark:bg-slate-800 p-3 space-y-1 shadow-sm text-left transition-colors duration-150 active:scale-[0.98] ${
            !currentQuestion ? 'border-slate-400 shadow-md' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
          }`}
        >
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">수업 요약</p>
          <p className="text-slate-900 dark:text-slate-100 text-sm font-medium">
            질문 {questionList.length}개 · {completedCount}개 진행 완료
          </p>
        </button>
      )}

      {!readOnly && (
        <details className="group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" open={questionList.length === 0 || showForm || formOpen || undefined}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 [&::-webkit-details-marker]:hidden">
            수업 준비 / 문항 편집
            <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-3 px-4 pb-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">문항 추가와 가져오기, 수업 도구를 여기서 준비하세요.</p>
            <div className="flex items-center gap-2 flex-wrap">
              {modeButton}
              <Button onClick={() => { if (onAddClick) onAddClick(); else setShowForm(!showForm); }} variant="secondary" size="sm" className="min-h-11">
                {showForm && !onAddClick ? '취소' : <><Plus size={14} /> 문항 추가</>}
              </Button>
              {adminUid && <Button onClick={() => setLibraryOpen(true)} variant="secondary" size="sm" className="min-h-11"><BookmarkPlus size={14} /> 보관함</Button>}
              {isGeneratorReady() && <Button onClick={() => setAiGenOpen(true)} variant="secondary" size="sm" className="min-h-11"><Sparkles size={14} /> AI 생성</Button>}
              {questionList.length > 0 && <Button onClick={() => setResetConfirmOpen(true)} variant="ghost" size="sm" className="min-h-11 text-slate-500"><RotateCcw size={14} /> 답변 초기화</Button>}
            </div>
            {modeSlot}
            <AnimatePresence>{showForm && !onAddClick && <QuestionForm onSubmit={handleSubmit} onCancel={() => setShowForm(false)} error={error} />}</AnimatePresence>
          </div>
        </details>
      )}

      <QuestionList
        questionList={questionList} currentQuestion={currentQuestion}
        onActivate={handleActivate} onReveal={revealQuiz} onRevealAnswer={revealAnswer} onShowLeaderboard={showLeaderboard}
        onClearActive={clearActive} onEdit={!readOnly ? (onEditClick || undefined) : undefined}
        onDuplicate={duplicateQuestion} onDelete={deleteQuestion} onReset={resetQuestion}
        onReorder={reorderQuestion}
        onMoveUp={(qId) => moveQuestion(qId, 'up')} onMoveDown={(qId) => moveQuestion(qId, 'down')}
        readOnly={readOnly} onView={readOnly ? onViewQuestion : undefined}
        onSaveToLibrary={!readOnly && adminUid ? handleSaveToLibrary : undefined}
        persistentAssignmentId={persistentAssignmentId}
        onTogglePersistent={!readOnly ? handleTogglePersistent : undefined}
      />

      {!readOnly && adminUid && (
        <ImportFromLibraryModal open={libraryOpen} onClose={() => setLibraryOpen(false)}
          adminUid={adminUid} onImport={importFromLibrary} />
      )}

      <Toast message={toast} />

      <QuestionPreview questionList={questionList} open={previewOpen} onClose={() => setPreviewOpen(false)} />

      <AnimatePresence>
        {aiGenOpen && (
          <AIQuestionGenerator
            open={aiGenOpen}
            onClose={() => setAiGenOpen(false)}
            onUse={(draft) => importFromLibrary([draft])}
            onUseMany={(drafts) => importFromLibrary(drafts)}
          />
        )}
      </AnimatePresence>

      <ConfirmModal
        open={resetConfirmOpen}
        onConfirm={() => { setResetConfirmOpen(false); resetAllQuestions(resetClearParticipants); setResetClearParticipants(false); }}
        onCancel={() => { setResetConfirmOpen(false); setResetClearParticipants(false); }}
        title="전체 답변 초기화"
        description={resetDescription}
        confirmLabel="초기화"
        variant="danger"
      >
        <button
          type="button"
          onClick={() => setResetClearParticipants((v) => !v)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-left"
        >
          <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${resetClearParticipants ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-900' : 'border-slate-300 dark:border-slate-500'}`}>
            {resetClearParticipants && <Check size={13} />}
          </span>
          <span className="text-sm text-slate-600 dark:text-slate-300 leading-snug">
            참여자 목록도 함께 비우기
            <span className="block text-[11px] text-slate-400">리허설 접속자를 정리하고 본 행사를 깨끗하게 시작</span>
          </span>
        </button>
      </ConfirmModal>
    </div>
  );
}
