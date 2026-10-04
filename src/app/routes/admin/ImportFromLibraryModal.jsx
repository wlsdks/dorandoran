import { useState, useMemo } from 'react';
import { Search, X, Check, MessageSquare, Trash2 } from 'lucide-react';
import { useQuestionLibrary } from '@/features/questions/api/useQuestionLibrary';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import { QUESTION_TYPES } from '@/lib/question-types';

function PickableCard({ question, selected, onToggle, onDelete }) {
  const qType = QUESTION_TYPES.find((t) => t.value === question.type);
  const Icon = qType?.icon || MessageSquare;

  return (
    <div className="relative">
    {onDelete && (
      <button
        onClick={onDelete}
        aria-label="보관함에서 삭제"
        className="absolute right-2 top-2 z-10 p-1.5 rounded-md text-slate-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors duration-150 active:scale-90"
      >
        <Trash2 size={13} />
      </button>
    )}
    <button
      onClick={onToggle}
      className={`w-full text-left p-3 pr-9 rounded-xl border transition-colors duration-150 active:scale-[0.98] ${
        selected
          ? 'border-slate-400 bg-slate-50 dark:bg-slate-700 dark:border-slate-500 shadow-sm'
          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
          selected ? 'bg-slate-900 border-slate-900 dark:bg-slate-100 dark:border-slate-100' : 'border-slate-300'
        }`}>
          {selected && <Check size={12} className="text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Icon size={12} className="text-slate-400" />
            <span className="text-xs font-medium text-slate-400">{qType?.label}</span>
          </div>
          <p className="text-slate-800 dark:text-slate-200 text-sm leading-relaxed">{question.title}</p>
          {question.options && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {question.options.map((opt, i) => (
                <span
                  key={i}
                  className={`text-[11px] px-1.5 py-0.5 rounded-md ${
                    question.correctAnswer === opt
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'bg-slate-50 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                  }`}
                >
                  {opt}
                </span>
              ))}
            </div>
          )}
          {question.type === 'ox' && question.correctAnswer && (
            <div className="flex gap-1 mt-1.5">
              {['O', 'X'].map((v) => (
                <span
                  key={v}
                  className={`text-[11px] px-2 py-0.5 rounded-md font-semibold ${
                    question.correctAnswer === v
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'bg-slate-50 text-slate-400 dark:bg-slate-700 dark:text-slate-500'
                  }`}
                >
                  {v}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
    </div>
  );
}

export default function ImportFromLibraryModal({ open, onClose, adminUid, onImport }) {
  const { questions, loading, deleteQuestion } = useQuestionLibrary(adminUid);
  const [selected, setSelected] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // 보관함 항목 삭제 — 그동안 저장만 되고 지울 방법이 UI에 없어 누적됨
  function handleDelete(qId) {
    deleteQuestion(qId);
    setSelected((prev) => { const next = new Set(prev); next.delete(qId); return next; });
  }

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return questions;
    const query = searchQuery.toLowerCase();
    return questions.filter((q) => {
      const inTitle = q.title?.toLowerCase().includes(query);
      const inOptions = q.options?.some((o) => o.toLowerCase().includes(query));
      return inTitle || inOptions;
    });
  }, [questions, searchQuery]);

  function toggleSelect(qId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  }

  function handleImport() {
    const selectedQuestions = questions.filter((q) => selected.has(q.id));
    onImport(selectedQuestions);
    setSelected(new Set());
    setSearchQuery('');
    onClose();
  }

  function handleClose() {
    setSelected(new Set());
    setSearchQuery('');
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} ariaLabel="보관함에서 질문 가져오기">
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">보관함에서 가져오기</h2>
          <p className="text-slate-400 text-xs mt-0.5">저장된 질문을 선택하여 추가하세요</p>
        </div>

        {questions.length > 3 && (
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="질문 검색..."
              aria-label="보관함 질문 검색"
              className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg pl-9 pr-8 py-2 text-sm dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-600 focus:border-slate-400 transition-colors duration-150"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 hover:text-slate-500"
                aria-label="검색어 지우기"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}

        <div className="max-h-[50vh] overflow-y-auto space-y-1.5 -mx-1 px-1">
          {loading ? (
            <div className="text-center py-8 text-slate-400 text-sm">불러오는 중...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center text-center py-8 space-y-2">
              <DoranDoranMascot size="sm" mood="waiting" />
              <p className="text-slate-400 text-sm">
                {questions.length === 0 ? '저장된 질문이 없습니다' : '일치하는 질문이 없습니다'}
              </p>
              <p className="text-slate-400 text-xs">
                {questions.length === 0 ? '질문 보관함 탭에서 먼저 질문을 저장하세요' : '검색어를 변경해보세요'}
              </p>
            </div>
          ) : (
            filtered.map((q) => (
              <PickableCard
                key={q.id}
                question={q}
                selected={selected.has(q.id)}
                onToggle={() => toggleSelect(q.id)}
                onDelete={() => handleDelete(q.id)}
              />
            ))
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Button onClick={handleClose} variant="secondary" size="md" className="flex-1">
            취소
          </Button>
          <Button
            onClick={handleImport}
            variant="primary"
            size="md"
            className="flex-1"
            disabled={selected.size === 0}
          >
            {selected.size > 0 ? `${selected.size}개 추가` : '선택하세요'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
