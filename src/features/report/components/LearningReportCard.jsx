import { useAIAvailability } from '@/hooks/useAIAvailability';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, BookOpen, Target, RefreshCw, AlertCircle, Lightbulb } from 'lucide-react';
import { generateLearningReport } from '@/features/report/api/generateLearningReport';

export default function LearningReportCard({ stats }) {
  const { studentFeaturesAvailable } = useAIAvailability();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  if (!studentFeaturesAvailable) return null;
  if (!stats || (stats.answeredCount || 0) < 2) return null;

  async function handleGenerate() {
    if (!studentFeaturesAvailable || loading) return;
    setLoading(true);
    setError('');
    try {
      const r = await generateLearningReport({ stats });
      setResult(r);
    } catch (err) {
      setError(err.message || '리포트 생성 실패');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="w-6 flex items-center justify-center shrink-0">
          <Lightbulb size={16} className="text-slate-500 dark:text-slate-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-slate-900 dark:text-slate-100">AI 개인 리포트</p>
          <p className="text-[12px] text-slate-400">오늘 내 답변만 근거로 요약</p>
        </div>
        {!result && (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all ${
              loading
                ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200'
            }`}
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Lightbulb size={13} />}
            {loading ? '작성 중' : '리포트 받기'}
          </button>
        )}
        {result && (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <RefreshCw size={11} /> 새로
          </button>
        )}
      </div>

      {error && <p className="px-5 pb-3 text-xs text-red-500">{error}</p>}

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            {!result.canGenerate ? (
              <div className="px-5 pb-5 pt-1">
                <div className="flex items-start gap-2 rounded-lg bg-slate-50 dark:bg-slate-700/30 px-3 py-2.5">
                  <AlertCircle size={14} className="text-slate-400 mt-0.5 shrink-0" />
                  <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {result.reason || '리포트를 작성하기에 답변 데이터가 부족해요.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="px-5 pb-5 pt-1 border-t border-slate-100 dark:border-slate-700 space-y-4">
                {result.summary && (
                  <p className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 leading-relaxed pt-3">
                    "{result.summary}"
                  </p>
                )}

                {result.keyLearnings?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <BookOpen size={13} className="text-slate-500 dark:text-slate-400" />
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">오늘 배운 내용</p>
                    </div>
                    <ul className="space-y-1.5">
                      {result.keyLearnings.map((x, i) => (
                        <li key={i} className="text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed pl-4 relative">
                          <span className="absolute left-0 top-2 w-1 h-1 rounded-full bg-slate-400" />{x}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.participationHighlights?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">참여 하이라이트</p>
                    <ul className="space-y-1">
                      {result.participationHighlights.map((x, i) => (
                        <li key={i} className="text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed">{x}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.reviewRecommend?.length > 0 && (
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Target size={13} className="text-amber-500" />
                      <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">복습 추천</p>
                    </div>
                    <ul className="space-y-1">
                      {result.reviewRecommend.map((x, i) => (
                        <li key={i} className="text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed">· {x}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.closingNote && (
                  <p className="text-[13px] text-slate-600 dark:text-slate-300 italic text-center pt-1">{result.closingNote}</p>
                )}

                <p className="text-[10px] text-slate-400 italic text-center">AI가 내 답변 데이터만 근거로 작성했어요</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
