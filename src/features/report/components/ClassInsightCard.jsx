import { useAIAvailability } from '@/hooks/useAIAvailability';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle, TrendingUp, Target, Info, RefreshCw, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import { generateClassInsight } from '@/features/report/api/generateClassInsight';

// 심각도별 — 배경 통일(slate), 강조는 텍스트 색상으로 (§1)
const SEVERITY_STYLES = {
  high: 'bg-slate-100 text-amber-700 border-slate-200 dark:bg-slate-700 dark:text-amber-300 dark:border-slate-600',
  medium: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600',
  low: 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
};

export default function ClassInsightCard({ session, participantCount, insights, topStudent, avgCorrectRate, activityRate }) {
  const { available, reason } = useAIAvailability();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [findingsOpen, setFindingsOpen] = useState(false);
  const [patternOpen, setPatternOpen] = useState(false);

  if (!insights || insights.length < 2 || participantCount < 3) return null;

  async function handleGenerate() {
    if (!available || loading) return;
    setLoading(true);
    setError('');
    try {
      const r = await generateClassInsight({ session, participantCount, insights, topStudent, avgCorrectRate, activityRate });
      setResult(r);
      setFindingsOpen(false);
      setPatternOpen(false);
    } catch (err) {
      setError(err.message || '인사이트 생성 실패');
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
          <p className="text-[14px] font-bold text-slate-900 dark:text-slate-100">AI 수업 인사이트</p>
          <p className="text-[12px] text-slate-400">{available ? '오늘 데이터로 다음 수업 개선점 추천' : reason}</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading || !available}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all ${
            loading || !available
              ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200'
          }`}
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : result ? <RefreshCw size={13} /> : <Lightbulb size={13} />}
          {loading ? '분석 중' : result ? '다시 분석' : '분석하기'}
        </button>
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
            {!result.canAnalyze ? (
              <div className="px-5 pb-5 pt-1">
                <div className="flex items-start gap-2 rounded-lg bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700 px-3 py-2.5">
                  <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-[12px] text-slate-700 dark:text-slate-200 leading-relaxed">
                    {result.reason || '의미 있는 인사이트를 도출하기에 데이터가 부족해요.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="px-5 pb-5 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-4">
                {/* 1. 최상단 — 다음 수업 액션 (가장 actionable) */}
                {result.nextClassActions?.length > 0 && (
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700 p-4">
                    <div className="flex items-center gap-1.5 mb-3">
                      <Target size={14} className="text-indigo-600 dark:text-indigo-400" />
                      <p className="text-[13px] font-bold text-slate-900 dark:text-slate-100">다음 수업, 이렇게 해보세요</p>
                    </div>
                    <ol className="space-y-2.5">
                      {result.nextClassActions.map((a, i) => (
                        <li key={i} className="flex gap-2 text-[13px] text-indigo-900 dark:text-indigo-100 leading-relaxed">
                          <span className="shrink-0 w-4 text-[13px] font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">{i + 1}.</span>
                          <span>{a}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* 2. 종합 요약 — 한눈에 */}
                {result.overallSummary && (
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-700/30 p-3">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">오늘 수업 한 줄</p>
                    <p className="text-[13px] text-slate-800 dark:text-slate-100 leading-relaxed">{result.overallSummary}</p>
                  </div>
                )}

                {/* 3. 핵심 발견 (접기) */}
                {result.keyFindings?.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setFindingsOpen(!findingsOpen)}
                      className="w-full flex items-center justify-between px-1 py-1 text-left hover:bg-slate-50 dark:hover:bg-slate-700/30 rounded transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <TrendingUp size={13} className="text-slate-500 dark:text-slate-400" />
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">핵심 발견 {result.keyFindings.length}개</p>
                      </div>
                      {findingsOpen ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}
                    </button>
                    <AnimatePresence>
                      {findingsOpen && (
                        <motion.ul
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden space-y-1.5 mt-2"
                        >
                          {result.keyFindings.map((f, i) => (
                            <li key={i} className={`rounded-lg border px-3 py-2 text-[13px] leading-relaxed ${SEVERITY_STYLES[f.severity] || SEVERITY_STYLES.medium}`}>
                              {f.finding}
                            </li>
                          ))}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* 4. 참여 패턴 (접기) */}
                {result.participationPattern && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setPatternOpen(!patternOpen)}
                      className="w-full flex items-center justify-between px-1 py-1 text-left hover:bg-slate-50 dark:hover:bg-slate-700/30 rounded transition-colors"
                    >
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">참여 패턴</p>
                      {patternOpen ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}
                    </button>
                    <AnimatePresence>
                      {patternOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <p className="text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed mt-1.5">{result.participationPattern}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* 5. 한계 (상시 작게) */}
                {result.caveats && (
                  <div className="flex items-start gap-1.5 rounded-lg bg-slate-50 dark:bg-slate-700/30 px-3 py-2">
                    <Info size={12} className="text-slate-400 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{result.caveats}</p>
                  </div>
                )}

                <p className="text-[10px] text-slate-400 italic text-center">AI가 통계 데이터만 근거로 작성한 참고용 해석입니다</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
