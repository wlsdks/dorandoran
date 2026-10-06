import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Plus } from 'lucide-react';
import { useQuestionLibrary } from '@/features/questions/api/useQuestionLibrary';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import Toast from '@/components/ui/Toast';
import ConfirmModal from '@/components/ui/ConfirmModal';
import QuestionForm from './QuestionForm';
import TemplatePacks from './TemplatePacks';
import LibraryQuestionCard from './LibraryQuestionCard';
import LibrarySearchFilter from './LibrarySearchFilter';
import { QUIZ_DEFAULTS } from '@/lib/quiz';
import { buildQuestionData } from '@/lib/question';
import { useToast } from '@/hooks/useToast';
export default memo(function QuestionLibraryView({
  adminUid
}) {
  const {
    questions,
    loading,
    saveQuestion,
    deleteQuestion,
    updateQuestion
  } = useQuestionLibrary(adminUid);
  const [showForm, setShowForm] = useState(false);
  // 보관함 질문 수정 — 수업 화면과 같은 질문 폼을 기존 값으로 연다
  const [editing, setEditing] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const {
    toast,
    showToast
  } = useToast();
  const filtered = questions.filter(q => {
    if (typeFilter !== 'all' && q.type !== typeFilter) return false;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const inTitle = q.title?.toLowerCase().includes(query);
      const inOptions = q.options?.some(o => o.toLowerCase().includes(query));
      const inTag = q.tag?.toLowerCase().includes(query);
      if (!inTitle && !inOptions && !inTag) return false;
    }
    return true;
  });
  // 수업에서 만드는 질문과 같은 조립 함수를 쓴다 — 이미지·정답 해설·힌트 등이 보관함에서 빠지지 않게.
  async function handleSubmit(fields) {
    const questionData = {
      type: fields.type,
      title: fields.title.trim(),
      ...buildQuestionData(fields.type, fields)
    };
    if (editing) {
      const ok = await updateQuestion(editing.id, questionData);
      if (ok) {
        showToast('질문이 수정되었습니다');
        setEditing(null);
      }
      return ok;
    }
    const qId = await saveQuestion(questionData);
    if (qId) {
      showToast('질문이 보관함에 저장되었습니다');
      return true;
    }
    return false;
  }
  function handleEdit(question) {
    setShowForm(false);
    setEditing(question);
  }
  async function handleImportPack(packQuestions) {
    let count = 0;
    for (const q of packQuestions) {
      const questionData = {
        type: q.type,
        title: q.title
      };
      if (q.options) questionData.options = q.options;
      if (q.correctAnswer) questionData.correctAnswer = q.correctAnswer;
      if (q.type === 'quiz') {
        questionData.points = q.points || QUIZ_DEFAULTS.points;
        questionData.speedWindowMs = QUIZ_DEFAULTS.speedWindowMs;
        questionData.maxSpeedBonus = QUIZ_DEFAULTS.maxSpeedBonus;
      }
      const id = await saveQuestion(questionData);
      if (id) count++;
    }
    if (count > 0) showToast(`${count}개 질문이 보관함에 추가되었습니다`);
  }
  // 보관함 삭제는 되돌릴 수 없어 한 번 확인한다.
  const [pendingDelete, setPendingDelete] = useState(null);
  function handleDelete(qId) {
    setPendingDelete(questions.find((q) => q.id === qId) || { id: qId });
  }
  async function confirmDelete() {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    const ok = await deleteQuestion(target.id);
    if (ok) showToast('질문이 삭제되었습니다');
  }
  if (loading) {
    return <div className="flex items-center justify-center py-16 text-slate-500 dark:text-slate-400">
        <Loader2 size={20} className="animate-spin mr-2" />
        불러오는 중...
      </div>;
  }
  return <div className="space-y-5">
      <ConfirmModal open={!!pendingDelete} onCancel={() => setPendingDelete(null)} onConfirm={confirmDelete}
        title="보관함에서 삭제할까요?" description={pendingDelete?.title ? `"${pendingDelete.title}" 질문이 보관함에서 삭제돼요. 되돌릴 수 없어요.` : '이 질문이 보관함에서 삭제돼요. 되돌릴 수 없어요.'}
        confirmLabel="삭제" variant="danger" />
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-snug">질문 보관함</h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            {questions.length > 0 ? `${questions.length}개의 질문이 저장됨` : '자주 쓰는 질문을 저장하세요'}
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(!showForm); }} variant={showForm ? 'ghost' : 'primary'} size="sm">
          {showForm ? '취소' : <><Plus size={14} /> 새 질문</>}
        </Button>
      </div>

      {/* New question form */}
      <AnimatePresence>
        {(showForm || editing) && <motion.div key={editing?.id || 'new'} initial={{
        opacity: 0,
        height: 0
      }} animate={{
        opacity: 1,
        height: 'auto'
      }} exit={{
        opacity: 0,
        height: 0
      }} transition={{
        duration: 0.2
      }} className="overflow-hidden">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5">
              {editing && <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">보관함 질문 수정</p>}
              <QuestionForm key={editing?.id || 'new'} initialData={editing || undefined} onSubmit={handleSubmit} onCancel={() => { setShowForm(false); setEditing(null); }} error={null} />
            </div>
          </motion.div>}
      </AnimatePresence>

      {/* Search + filter */}
      {questions.length > 0 && <LibrarySearchFilter searchQuery={searchQuery} onSearchChange={setSearchQuery} typeFilter={typeFilter} onTypeChange={setTypeFilter} />}

      {/* Question list */}
      {questions.length === 0 && !showForm ? <EmptyState title="저장된 질문이 없습니다" description="자주 사용하는 질문을 보관함에 저장해두면 클래스에 바로 추가할 수 있습니다" steps={['위의 "새 질문" 버튼으로 질문을 만드세요', '세션에서 사용한 질문도 여기에 저장할 수 있습니다', '보관함의 질문은 언제든 클래스에 추가할 수 있습니다']} mascotSize="md" mood="thinking" className="py-8" /> : <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((q, i) => <LibraryQuestionCard key={q.id} question={q} onDelete={handleDelete} onEdit={handleEdit} index={i} />)}
          </AnimatePresence>

          {filtered.length === 0 && questions.length > 0 && <motion.div initial={{
        opacity: 0
      }} animate={{
        opacity: 1
      }} className="flex flex-col items-center text-center py-10 space-y-2">
              <DoranDoranMascot size="sm" mood="waiting" />
              <p className="text-slate-500 dark:text-slate-400 text-sm">일치하는 질문이 없습니다</p>
              <p className="text-slate-500 dark:text-slate-400 text-xs">검색어나 필터를 변경해보세요</p>
            </motion.div>}
        </div>}

      {/* Template packs — at the bottom */}
      <TemplatePacks onImportPack={handleImportPack} />

      <Toast message={toast} />
    </div>;
});
