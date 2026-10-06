import { useAIAvailability } from '@/hooks/useAIAvailability';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, TrendingUp, Zap, Loader2, Lightbulb } from 'lucide-react';
import { previewSubmission } from '@/lib/judging/gemini';

const COOLDOWN_MS = 2 * 60 * 1000; // 2분
const STORAGE_KEY = 'dorandoran_preview_last_ts';

function useCooldown() {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const last = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
    const elapsed = Date.now() - last;
    if (elapsed < COOLDOWN_MS) {
      setRemaining(Math.ceil((COOLDOWN_MS - elapsed) / 1000));
      const timer = setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) { clearInterval(timer); return 0; }
          return r - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, []);

  function markUsed() {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setRemaining(Math.ceil(COOLDOWN_MS / 1000));
  }

  return { remaining, markUsed };
}

export default function SubmissionPreview({ submission, disabled }) {
  const { studentFeaturesAvailable } = useAIAvailability();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const { remaining, markUsed } = useCooldown();

  if (!studentFeaturesAvailable) return null;

  const canUse = !disabled && !loading && remaining === 0 && studentFeaturesAvailable;

  async function handlePreview() {
    if (!canUse) return;
    setLoading(true);
    setError('');
    markUsed();
    try {
      const r = await previewSubmission(submission);
      setResult(r);
    } catch (err) {
      setError(err.message || '미리보기 심사에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  const label = loading ? 'AI가 살펴보는 중...'
    : remaining > 0 ? `잠시 후 다시 시도 (${remaining}초)`
    : !studentFeaturesAvailable ? 'AI 예심 준비 안 됨'
    : disabled ? 'PRD와 스크린샷을 먼저 입력하세요'
    : 'AI 예심 받기';
  const showSparklesIcon = canUse && !loading && remaining === 0 && studentFeaturesAvailable && !disabled;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-6 flex items-center justify-center shrink-0">
          <Lightbulb size={16} className="text-slate-500 dark:text-slate-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">제출 전 AI 예심</p>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
            본 심사 전에 AI 코치가 개선점을 알려드려요. 받아보고 다시 수정한 뒤 제출할 수 있어요.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={handlePreview}
        disabled={!canUse}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
          canUse
            ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 active:scale-[0.98]'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
        }`}
      >
        {loading && <Loader2 size={14} className="animate-spin" />}
        {showSparklesIcon && <Lightbulb size={14} />}
        {label}
      </button>

      {error && (
        <p className="text-xs text-red-500 mt-2">{error}</p>
      )}

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-4 pt-4 border-t border-slate-100 dark:border-slate-700">
              {result.overallImpression && (
                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed italic">
                  "{result.overallImpression}"
                </p>
              )}

              {result.strengths?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Check size={13} className="text-emerald-500" />
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">잘된 점</p>
                  </div>
                  <ul className="space-y-1.5">
                    {result.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed pl-4 relative">
                        <span className="absolute left-0 top-2 w-1 h-1 rounded-full bg-emerald-500" />{s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.improvements?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingUp size={13} className="text-indigo-500" />
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">개선하면 좋을 점</p>
                  </div>
                  <ul className="space-y-1.5">
                    {result.improvements.map((s, i) => (
                      <li key={i} className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed pl-4 relative">
                        <span className="absolute left-0 top-2 w-1 h-1 rounded-full bg-indigo-500" />{s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.quickWin && (
                <div className="rounded-lg bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Zap size={13} className="text-amber-500" />
                    <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">당장 해볼 것</p>
                  </div>
                  <p className="text-sm text-slate-900 dark:text-slate-100 leading-relaxed">{result.quickWin}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
