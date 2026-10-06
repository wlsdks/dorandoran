import { useAIAvailability } from '@/hooks/useAIAvailability';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Loader2, Lightbulb } from 'lucide-react';
import { useVotes } from '@/hooks/useVotes';
import { summarizeResponses } from '@/features/questions/api/summarizeResponses';

const MIN_RESPONSES = 5;

export default function AISummaryBanner({ sessionId, questionId, questionTitle, questionType }) {
  const { available, reason } = useAIAvailability();
  const { voteList } = useVotes(sessionId, questionId);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [resultForCount, setResultForCount] = useState(0);

  const responses = useMemo(
    () => voteList.map((v) => v.value).filter(Boolean),
    [voteList]
  );

  const responseCount = responses.length;
  const canSummarize = available && responseCount >= MIN_RESPONSES && !loading;
  const isStale = result && responseCount > resultForCount + 3; // 응답이 3개 이상 더 쌓이면 stale

  async function handleSummarize() {
    if (!canSummarize) return;
    setLoading(true);
    setError('');
    try {
      const r = await summarizeResponses({
        questionTitle,
        questionType,
        responses,
      });
      setResult(r);
      setResultForCount(responseCount);
    } catch (err) {
      setError(err.message || '요약 실패');
    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="w-full max-w-xl mx-auto mb-4">
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-6 flex items-center justify-center shrink-0">
            <Lightbulb size={15} className="text-slate-500 dark:text-slate-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">AI 응답 요약</p>
            <p className="text-[11px] text-slate-400">
              {!available ? reason : responseCount < MIN_RESPONSES
                ? `응답 ${MIN_RESPONSES}개부터 사용 가능 (현재 ${responseCount}개)`
                : result ? `${resultForCount}개 응답 분석됨${isStale ? ' · 새 응답이 있어요' : ''}`
                : `${responseCount}개 응답 분석 가능`}
            </p>
          </div>
          <button
            onClick={handleSummarize}
            disabled={!canSummarize}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
              canSummarize
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
            }`}
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : result ? <RefreshCw size={12} /> : <Lightbulb size={12} />}
            {loading ? '분석 중' : result ? '새로 분석' : '분석하기'}
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
              <div className="px-4 pb-4 pt-1 space-y-3 border-t border-slate-100 dark:border-slate-700">
                {result.themes?.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-3">
                    {result.themes.map((t, i) => (
                      <div key={i} className="rounded-lg bg-slate-50 dark:bg-slate-700/50 p-3">
                        <div className="flex items-baseline justify-between mb-1">
                          <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{t.label}</p>
                          <span className="text-[11px] font-medium text-slate-400">{t.count}명</span>
                        </div>
                        <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-3">{t.summary}</p>
                      </div>
                    ))}
                  </div>
                )}
                {result.insight && (
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700 px-3 py-2">
                    <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-0.5">인사이트</p>
                    <p className="text-sm text-slate-900 dark:text-slate-100 leading-relaxed">{result.insight}</p>
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
