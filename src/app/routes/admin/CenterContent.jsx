import { lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { ref, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import QuestionForm from './QuestionForm';
import { MainContent } from './PresentationView';
import { SuspenseFallback } from '@/components/ui/Skeleton';
import PersistentAssignmentBar from '@/features/ai-judge/components/PersistentAssignmentBar';
import { isQuizQuestion } from '@/lib/quiz';
import { normalizeRankingHighlight } from '@/lib/ranking-highlight';

const ClassSummary = lazy(() => import('./ClassSummary'));

export default function CenterContent({
  showCenterForm,
  onHideCenterForm,
  onCenterFormSubmit,
  editingQuestion,
  effectiveReadOnly,
  session,
  currentMode,
  sessionId,
  onlineList,
  leaderboard,
  drawParticipants,
  participants,
  scores,
  count,
  onGameResult,
}) {
  return (
    <div className="h-full flex flex-col">
    <AnimatePresence mode="wait">
      {showCenterForm ? (
        <motion.div
          key="center-form"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-2xl mx-auto"
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 lg:p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {editingQuestion ? '질문 수정' : '새 질문 추가'}
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  {editingQuestion ? '질문 내용을 수정하세요' : '질문을 작성하고 추가하세요'}
                </p>
              </div>
              <button
                onClick={onHideCenterForm}
                className="p-2 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors duration-150 active:scale-90"
                aria-label="취소"
              >
                <X size={20} />
              </button>
            </div>
            <QuestionForm
              key={editingQuestion?.qId || 'new'}
              onSubmit={onCenterFormSubmit}
              onCancel={onHideCenterForm}
              error={null}
              initialData={editingQuestion?.data}
            />
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="main-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="w-full flex-1 flex flex-col"
        >
          {/* 상시 과제 요약 바 — 강사 편집 모드에서만 */}
          {!effectiveReadOnly && session?.persistentAssignmentId && (
            <div className="mb-4">
              <PersistentAssignmentBar
                sessionId={sessionId}
                session={session}
                onActivateQuestion={(qId) => {
                  const q = session?.questions?.[qId];
                  if (!q) return;
                  const mode = isQuizQuestion(q) ? 'quiz' : 'poll';
                  update(ref(db, `sessions/${sessionId}`), {
                    currentQuestion: qId, currentMode: mode,
                    [`questions/${qId}/activatedAt`]: Date.now(),
                  });
                }}
              />
            </div>
          )}
          {effectiveReadOnly && !session?.currentQuestion ? (
            <Suspense fallback={<SuspenseFallback fullPage={false} />}>
              <ClassSummary
                session={session}
                participants={participants}
                scores={scores}
                leaderboard={leaderboard}
                count={count}
              />
            </Suspense>
          ) : (
            <MainContent
              currentMode={currentMode}
              sessionId={sessionId}
              session={session}
              onlineList={onlineList}
              leaderboard={leaderboard}
              drawParticipants={drawParticipants}
              scores={scores}
              count={count}
              onGameResult={onGameResult}
              onLeaderboardPageChange={effectiveReadOnly ? undefined : page => update(ref(db, `sessions/${sessionId}`), { leaderboardPage: page })}
              onHighlightChange={effectiveReadOnly ? undefined : config => {
                const selected = normalizeRankingHighlight(config);
                return update(ref(db, `sessions/${sessionId}`), {
                  leaderboardHighlight: selected,
                  ...(selected ? { leaderboardPage: Math.floor((selected.activeRank - 1) / 8) } : {}),
                });
              }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
    </div>
  );
}
