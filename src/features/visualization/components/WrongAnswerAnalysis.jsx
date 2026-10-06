import { useAIAvailability } from '@/hooks/useAIAvailability';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, TrendingDown, Lightbulb, AlertCircle } from 'lucide-react';
import { useVotes } from '@/hooks/useVotes';
import { analyzeWrongAnswers } from '@/features/questions/api/analyzeWrongAnswers';

export default function WrongAnswerAnalysis({ sessionId, questionId, questionTitle, options, correctAnswer }) {
  const { available, reason } = useAIAvailability();
  const { voteList } = useVotes(sessionId, questionId);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const voteDistribution = useMemo(() => {
    const dist = Object.create(null);
    for (const v of voteList) {
      if (v.value) dist[v.value] = (dist[v.value] || 0) + 1;
    }
    return dist;
  }, [voteList]);

  const totalVotes = voteList.length;
  const correctCount = voteDistribution[correctAnswer] || 0;
  const wrongCount = totalVotes - correctCount;

  // Hide if AI not ready, no correct answer set, too few responses, or all correct
  if (!correctAnswer || !options?.length) return null;
  if (totalVotes < 3) return null;
  if (wrongCount === 0) return null;

  async function handleAnalyze() {
    if (!available || loading) return;
    setLoading(true);
    setError('');
    try {
      const r = await analyzeWrongAnswers({
        questionTitle,
        options,
        correctAnswer,
        voteDistribution,
      });
      setResult(r);
    } catch (err) {
      setError(err.message || '분석 실패');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto mt-4">
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-6 flex items-center justify-center shrink-0">
            <TrendingDown size={15} className="text-slate-500 dark:text-slate-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">AI 오답 분석</p>
            <p className="text-[11px] text-slate-400">
              {available ? `${wrongCount}명이 오답을 선택 · 원인 분석 후 부연 설명 추천` : reason}
            </p>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading || !available}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
              loading || !available
                ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200'
            }`}
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Lightbulb size={12} />}
            {loading ? '분석 중' : result ? '다시 분석' : '분석하기'}
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
                {!result.canAnalyze ? (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700 px-3 py-2.5">
                    <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[12px] font-semibold text-slate-900 dark:text-slate-100">AI 분석 보류</p>
                      <p className="text-[12px] text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                        확실하지 않아 분석을 보류했어요. {result.reason ? `(${result.reason})` : ''} 학생들에게 직접 이유를 물어보시는 게 좋겠어요.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {result.topWrongAnswer && (
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">가장 많이 선택된 오답</p>
                        <p className="text-[13px] font-medium text-slate-900 dark:text-slate-100">{result.topWrongAnswer}</p>
                      </div>
                    )}
                    {result.likelyConfusion && (
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">추정 혼동 지점</p>
                        <p className="text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed">{result.likelyConfusion}</p>
                      </div>
                    )}
                    {result.suggestedExplanation && (
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700 px-3 py-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Lightbulb size={13} className="text-indigo-600 dark:text-indigo-400" />
                          <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">부연 설명 추천</p>
                        </div>
                        <p className="text-[13px] text-slate-900 dark:text-slate-100 leading-relaxed">{result.suggestedExplanation}</p>
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400 italic">AI 추정·참고용입니다. 수업 맥락은 강사님이 가장 잘 아세요.</p>
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
