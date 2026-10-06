import { useAIAvailability } from '@/hooks/useAIAvailability';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, Loader2, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { generateAnalogies } from '@/features/questions/api/generateAnalogies';

export default function AnalogyHelper({ questionTitle, options, correctAnswer }) {
  const { available, reason } = useAIAvailability();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState({ 0: true, 1: false, 2: false });

  if (!questionTitle) return null;

  async function handleGenerate() {
    if (!available || loading) return;
    setLoading(true);
    setError('');
    try {
      const r = await generateAnalogies({ questionTitle, options, correctAnswer });
      setResult(r);
      setExpanded({ 0: true, 1: false, 2: false });
    } catch (err) {
      setError(err.message || '비유 생성 실패');
    } finally {
      setLoading(false);
    }
  }

  function toggle(i) {
    setExpanded(prev => ({ ...prev, [i]: !prev[i] }));
  }

  return (
    <div className="w-full max-w-4xl mx-auto mt-3">
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-6 flex items-center justify-center shrink-0">
            <Lightbulb size={15} className="text-slate-500 dark:text-slate-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">AI 설명 비유</p>
            <p className="text-[11px] text-slate-600 dark:text-slate-300">{available ? '어려운 개념을 설명할 때 참고할 비유·예시' : reason}</p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading || !available}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
              loading || !available
                ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200'
            }`}
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : result ? <RefreshCw size={12} /> : <Lightbulb size={12} />}
            {loading ? '생성 중' : result ? '다시' : '비유 만들기'}
          </button>
        </div>

        {error && <p className="px-4 pb-3 text-xs text-red-500">{error}</p>}

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-700">
                {!result.canGenerate ? (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700 px-3 py-2.5">
                    <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[12px] font-semibold text-slate-900 dark:text-slate-100">AI 비유 생성 보류</p>
                      <p className="text-[12px] text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                        {result.reason || '주제를 정확히 파악하지 못해 비유를 만들지 않았어요.'} 강사님이 직접 예시를 들어주세요.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {result.topic && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 italic">이해한 주제: {result.topic}</p>
                    )}
                    {result.analogies.map((a, i) => {
                      const open = !!expanded[i];
                      return (
                        <div key={i} className="rounded-lg bg-slate-50 dark:bg-slate-700/50 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => toggle(i)}
                            className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 min-w-0">
                              <Lightbulb size={13} className="text-amber-500 shrink-0" />
                              <span className="truncate">{a.title}</span>
                            </span>
                            {open ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
                          </button>
                          <AnimatePresence>
                            {open && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="px-3 pb-3 pt-0 space-y-1.5">
                                  <p className="text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed">{a.body}</p>
                                  {a.limitation && (
                                    <p className="text-[11px] text-slate-600 dark:text-slate-300 italic">한계: {a.limitation}</p>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                    <p className="text-[10px] text-slate-600 dark:text-slate-300 italic">{result.disclaimer || 'AI 생성이므로 강사님이 정확성 확인 후 사용하세요'}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
