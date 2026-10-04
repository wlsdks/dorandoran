import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Plus } from 'lucide-react';
import { useQuestionLibrary } from '@/features/questions/api/useQuestionLibrary';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import Toast from '@/components/ui/Toast';
import QuestionForm from './QuestionForm';
import TemplatePacks from './TemplatePacks';
import LibraryQuestionCard from './LibraryQuestionCard';
import LibrarySearchFilter from './LibrarySearchFilter';
import { QUIZ_DEFAULTS } from '@/lib/quiz';
import { useToast } from '@/hooks/useToast';

export default memo(function QuestionLibraryView({ adminUid }) {
  const { questions, loading, saveQuestion, deleteQuestion } = useQuestionLibrary(adminUid);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const { toast, showToast } = useToast();

  const filtered = questions.filter((q) => {
    if (typeFilter !== 'all' && q.type !== typeFilter) return false;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const inTitle = q.title?.toLowerCase().includes(query);
      const inOptions = q.options?.some((o) => o.toLowerCase().includes(query));
      const inTag = q.tag?.toLowerCase().includes(query);
      if (!inTitle && !inOptions && !inTag) return false;
    }
    return true;
  });

  async function handleSubmit({ type, title, options: cleanOptions, correctAnswer, points }) {
    const questionData = { type, title: title.trim() };
    const isChoiceLike = type === 'choice' || type === 'quiz';

    if (isChoiceLike) {
      questionData.options = cleanOptions;
      questionData.correctAnswer = cleanOptions.includes(correctAnswer) ? correctAnswer : cleanOptions[0];
    }
    if (type === 'ox') {
      questionData.correctAnswer = correctAnswer || 'O';
    }
    if (type === 'quiz') {
      questionData.points = points || QUIZ_DEFAULTS.points;
      questionData.participationTickets = QUIZ_DEFAULTS.participationTickets;
      questionData.correctBonusTickets = QUIZ_DEFAULTS.correctBonusTickets;
      questionData.speedWindowMs = QUIZ_DEFAULTS.speedWindowMs;
      questionData.maxSpeedBonus = QUIZ_DEFAULTS.maxSpeedBonus;
    }

    const qId = await saveQuestion(questionData);
    if (qId) {
      showToast('질문이 보관함에 저장되었습니다');
      return true;
    }
    return false;
  }

  async function handleImportPack(packQuestions) {
    let count = 0;
    for (const q of packQuestions) {
      const questionData = { type: q.type, title: q.title };
      if (q.options) questionData.options = q.options;
      if (q.correctAnswer) questionData.correctAnswer = q.correctAnswer;
      if (q.type === 'quiz') {
        questionData.points = q.points || QUIZ_DEFAULTS.points;
        questionData.participationTickets = QUIZ_DEFAULTS.participationTickets;
        questionData.correctBonusTickets = QUIZ_DEFAULTS.correctBonusTickets;
        questionData.speedWindowMs = QUIZ_DEFAULTS.speedWindowMs;
        questionData.maxSpeedBonus = QUIZ_DEFAULTS.maxSpeedBonus;
      }
      const id = await saveQuestion(questionData);
      if (id) count++;
    }
    if (count > 0) showToast(`${count}개 질문이 보관함에 추가되었습니다`);
  }

  async function handleDelete(qId) {
    const ok = await deleteQuestion(qId);
    if (ok) showToast('질문이 삭제되었습니다');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 size={20} className="animate-spin mr-2" />
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-snug">질문 보관함</h2>
          <p className="text-slate-400 text-xs mt-0.5">
            {questions.length > 0 ? `${questions.length}개의 질문이 저장됨` : '자주 쓰는 질문을 저장하세요'}
          </p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          variant={showForm ? 'ghost' : 'primary'}
          size="sm"
        >
          {showForm ? '취소' : <><Plus size={14} /> 새 질문</>}
        </Button>
      </div>

      {/* New question form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5">
              <QuestionForm
                onSubmit={handleSubmit}
                onCancel={() => setShowForm(false)}
                error={null}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search + filter */}
      {questions.length > 0 && (
        <LibrarySearchFilter
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          typeFilter={typeFilter}
          onTypeChange={setTypeFilter}
        />
      )}

      {/* Question list */}
      {questions.length === 0 && !showForm ? (
        <EmptyState
          title="저장된 질문이 없습니다"
          description="자주 사용하는 질문을 보관함에 저장해두면 클래스에 바로 추가할 수 있습니다"
          steps={[
            '위의 "새 질문" 버튼으로 질문을 만드세요',
            '세션에서 사용한 질문도 여기에 저장할 수 있습니다',
            '보관함의 질문은 언제든 클래스에 추가할 수 있습니다',
          ]}
          mascotSize="md"
          mood="thinking"
          className="py-8"
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((q, i) => (
              <LibraryQuestionCard
                key={q.id}
                question={q}
                onDelete={handleDelete}
                index={i}
              />
            ))}
          </AnimatePresence>

          {filtered.length === 0 && questions.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center text-center py-10 space-y-2"
            >
              <DoranDoranMascot size="sm" mood="waiting" />
              <p className="text-slate-400 text-sm">일치하는 질문이 없습니다</p>
              <p className="text-slate-400 dark:text-slate-500 text-xs">검색어나 필터를 변경해보세요</p>
            </motion.div>
          )}
        </div>
      )}

      {/* Template packs — at the bottom */}
      <TemplatePacks onImportPack={handleImportPack} />

      <Toast message={toast} />
    </div>
  );
});
