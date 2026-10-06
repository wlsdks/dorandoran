import { useAIAvailability } from '@/hooks/useAIAvailability';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Plus, RefreshCw, Check, Lightbulb } from 'lucide-react';
import { generateQuestions } from '@/features/questions/api/generateQuestions';

const TYPE_LABELS = {
  choice: '객관식',
  ox: 'O/X',
  wordcloud: '워드클라우드',
  scale: '5점 척도',
};

export default function AIQuestionGenerator({ open, onClose, onUse, onUseMany }) {
  const { configured, reason } = useAIAvailability();
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(4);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [error, setError] = useState('');
  const [usedIndexes, setUsedIndexes] = useState(new Set());

  async function handleGenerate() {
    if (!configured || !topic.trim() || loading) return;
    setLoading(true);
    setError('');
    setDrafts([]);
    setUsedIndexes(new Set());
    try {
      const qs = await generateQuestions({ topic: topic.trim(), count });
      if (!qs.length) {
        setError('생성된 질문이 없습니다. 주제를 조금 구체적으로 써보세요.');
      } else {
        setDrafts(qs);
      }
    } catch (err) {
      setError(err.message || '생성 실패');
    } finally {
      setLoading(false);
    }
  }

  function handleUse(idx) {
    onUse(drafts[idx]);
    setUsedIndexes(new Set([...usedIndexes, idx]));
  }

  function handleUseAll() {
    const remaining = drafts
      .map((_, i) => i)
      .filter((i) => !usedIndexes.has(i));
    if (onUseMany) {
      onUseMany(remaining.map((i) => drafts[i]));
    } else {
      remaining.forEach((i) => onUse(drafts[i]));
    }
    setUsedIndexes(new Set([...usedIndexes, ...remaining]));
  }

  function reset() {
    setTopic('');
    setDrafts([]);
    setError('');
    setUsedIndexes(new Set());
  }

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-6 flex items-center justify-center">
              <Lightbulb size={15} className="text-slate-500 dark:text-slate-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">AI 질문 생성</h3>
              <p className="text-[11px] text-slate-400">주제를 입력하면 AI가 질문을 제안합니다</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!configured ? (
            <div className="text-center py-12">
              <p className="text-sm text-slate-500">{reason}</p>
            </div>
          ) : (
            <>
              {/* Topic input */}
              <div>
                <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400 mb-2">주제 / 맥락</p>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="예: 바이브코딩으로 만든 첫 서비스 경험 공유, HTTP 상태코드 기본, 팀워크 중요성..."
                  rows={2}
                  className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3.5 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                  autoFocus
                />
              </div>

              {/* Count */}
              <div className="flex items-center gap-3">
                <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">질문 개수</p>
                <div className="flex items-center gap-1">
                  {[3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      onClick={() => setCount(n)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                        count === n
                          ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={!topic.trim() || loading}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all ${
                  topic.trim() && !loading
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 active:scale-[0.98]'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                }`}
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : drafts.length ? <RefreshCw size={14} /> : <Lightbulb size={14} />}
                {loading ? 'AI가 질문을 만드는 중...' : drafts.length ? '다시 생성' : '질문 생성'}
              </button>

              {error && <p className="text-xs text-red-500 text-center">{error}</p>}

              {/* Drafts */}
              <AnimatePresence>
                {drafts.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2 pt-2"
                  >
                    <div className="flex items-center justify-between pb-2">
                      <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">생성된 질문 {drafts.length}개</p>
                      <button
                        onClick={handleUseAll}
                        disabled={usedIndexes.size === drafts.length}
                        className={`text-[12px] font-medium transition-colors ${
                          usedIndexes.size === drafts.length
                            ? 'text-slate-300 cursor-not-allowed'
                            : 'text-slate-900 dark:text-slate-100 hover:underline'
                        }`}
                      >
                        전체 추가
                      </button>
                    </div>

                    {drafts.map((q, i) => {
                      const used = usedIndexes.has(i);
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className={`rounded-xl border p-3.5 transition-all ${
                            used
                              ? 'bg-slate-50 dark:bg-slate-700/30 border-slate-100 dark:border-slate-700 opacity-60'
                              : 'bg-white dark:bg-slate-700/50 border-slate-200 dark:border-slate-600'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-300">
                                  {TYPE_LABELS[q.type] || q.type}
                                </span>
                                {q.correctAnswer && (
                                  <span className="text-[10px] text-slate-400">정답: {q.correctAnswer}</span>
                                )}
                              </div>
                              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-relaxed">{q.title}</p>
                              {q.options?.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {q.options.map((opt, j) => (
                                    <span key={j} className="inline-flex px-2 py-0.5 rounded-md text-[11px] bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                      {opt}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => handleUse(i)}
                              disabled={used}
                              className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                                used
                                  ? 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-default'
                                  : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200'
                              }`}
                            >
                              {used ? <><Check size={12} className="text-emerald-500" /> 추가됨</> : <><Plus size={12} /> 추가</>}
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>

              {drafts.length > 0 && (
                <button onClick={reset} className="w-full text-[12px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 pt-1">
                  주제 새로 입력
                </button>
              )}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
