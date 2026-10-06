import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { spring } from '@/lib/motion';
import { Copy, Check, Link2, Download, ExternalLink } from 'lucide-react';
import { exportResultsCSV } from '@/features/assignments/api/useSubmissions';
import { JUDGES, getAwardById } from '@/lib/judging/judges';
import JudgeResultCard from './JudgeResultCard';
import SubmissionContentPreview from './SubmissionContentPreview';
import Avatar from '@/components/ui/Avatar';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import Tooltip from '@/components/ui/Tooltip';

/** Sort submissions by avgScore descending. */
function sortByScore(submissions, results) {
  return [...submissions].sort((a, b) => {
    const ra = results[a.id]?.summary?.avgScore || 0;
    const rb = results[b.id]?.summary?.avgScore || 0;
    return rb - ra;
  });
}

// ─── Stats Card ────────────────────────────────────
function StatCard({ value, label }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm py-4 px-3 text-center">
      <motion.p
        key={String(value)}
        initial={{ scale: 0.85, opacity: 0.5 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={spring.bouncy}
        className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums leading-none"
      >
        {value}
      </motion.p>
      <p className="text-xs text-slate-400 mt-2">{label}</p>
    </div>
  );
}

// ─── Submission Card ───────────────────────────────
function SubmissionCard({ submission, result, rank, awardInfo, passThreshold = 3 }) {
  const [expanded, setExpanded] = useState(false);
  const summary = result?.summary;
  const passed = summary && (summary.selectedCount ?? 0) >= passThreshold;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-5 active:scale-[0.99] transition-transform"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {rank != null && (
              <span className={`text-sm font-bold tabular-nums w-5 text-center shrink-0 ${
                rank === 1 ? 'text-slate-900 dark:text-slate-100'
                : rank <= 3 ? 'text-slate-600 dark:text-slate-300'
                : 'text-slate-300 dark:text-slate-500'
              }`}>
                {rank}
              </span>
            )}
            <Avatar name={submission.name} size="md" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {submission.name}
                </p>
                {awardInfo && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
                    {awardInfo.name}
                  </span>
                )}
              </div>
              {(submission.projectUrl || submission.fileName) && (
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  {submission.projectUrl || submission.fileName}
                </p>
              )}
            </div>
          </div>

          {summary && (
            <div className="text-right shrink-0">
              <motion.p
                key={String(summary.avgScore)}
                initial={{ scale: 0.85, opacity: 0.5 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={spring.bouncy}
                className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums leading-none"
              >
                {summary.avgScore}
              </motion.p>
              <div className="flex items-center gap-1.5 justify-end mt-1">
                <span className={`text-[11px] font-medium ${passed ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400'}`}>
                  {passed ? '합격' : '불합격'}
                </span>
                <span className="text-[11px] text-slate-300">·</span>
                <span className="text-[11px] text-slate-400 tabular-nums">
                  {summary.selectedCount}/{summary.totalJudges}
                </span>
              </div>
            </div>
          )}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-5">
              <SubmissionContentPreview submission={submission} />

              {result?.judges && (
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
                    AI 심사위원 7명 평가
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {JUDGES.map((judge) => (
                      <JudgeResultCard key={judge.id} judge={judge} result={result.judges[judge.id]} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Submissions Tab ───────────────────────────────
export default function SubmissionsView({ assignmentId, submissions, results, awards, hasResults, passThreshold = 3 }) {
  const [copied, setCopied] = useState(false);
  const submitUrl = `${window.location.origin}/submit?a=${assignmentId}`;

  function handleCopy(e) {
    e?.stopPropagation();
    navigator.clipboard?.writeText(submitUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleOpen(e) {
    e?.stopPropagation();
    window.open(submitUrl, '_blank', 'noopener,noreferrer');
  }

  const awardMap = useMemo(() => {
    if (!awards) return {};
    const map = {};
    Object.entries(awards).forEach(([awardId, data]) => {
      if (data.submissionId) {
        const info = getAwardById(awardId);
        if (info) map[data.submissionId] = info;
      }
    });
    return map;
  }, [awards]);

  const sorted = useMemo(() => sortByScore(submissions, results), [submissions, results]);

  const { passedCount, avgScore } = useMemo(() => {
    if (!hasResults) return { passedCount: null, avgScore: null };
    const vals = Object.values(results);
    const passed = vals.filter(r => (r.summary?.selectedCount ?? 0) >= passThreshold).length;
    const avg = (vals.reduce((s, r) => s + (r.summary?.avgScore || 0), 0) / Math.max(vals.length, 1)).toFixed(1);
    return { passedCount: passed, avgScore: avg };
  }, [results, hasResults, passThreshold]);

  return (
    <div className="space-y-6">
      {/* 제출 링크 — 복사/이동 분리 */}
      <div className="w-full flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
        {copied
          ? <Check size={16} className="text-emerald-500 shrink-0" />
          : <Link2 size={16} className="text-slate-300 shrink-0" />
        }
        <span className="text-sm text-slate-500 dark:text-slate-400 truncate flex-1 min-w-0">
          {copied ? '링크가 복사되었습니다' : submitUrl}
        </span>
        <Tooltip label="링크 복사">
          <button
            onClick={handleCopy}
            aria-label="제출 링크 복사"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
          >
            <Copy size={14} />
          </button>
        </Tooltip>
        <Tooltip label="새 탭에서 열기">
          <button
            onClick={handleOpen}
            aria-label="제출 페이지 새 탭에서 열기"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
          >
            <ExternalLink size={14} />
          </button>
        </Tooltip>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard value={submissions.length} label="제출" />
        <StatCard value={passedCount ?? '–'} label="합격" />
        <StatCard value={avgScore ?? '–'} label="평균" />
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center py-16">
          <DoranDoranMascot size="lg" mood="waiting" className="mx-auto" />
          <p className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-6">
            아직 제출된 과제가 없습니다
          </p>
          <p className="text-sm text-slate-400 mt-1">
            제출 링크를 학생들에게 공유해주세요
          </p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              {hasResults ? '심사 결과' : '제출 현황'}
            </p>
            {hasResults && (
              <button
                onClick={() => exportResultsCSV(submissions, results, passThreshold)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <Download size={13} />
                CSV
              </button>
            )}
          </div>
          <div className="space-y-2">
            {sorted.map((sub, i) => (
              <SubmissionCard
                key={sub.id}
                submission={sub}
                result={results[sub.id]}
                rank={hasResults ? i + 1 : null}
                awardInfo={awardMap[sub.id]}
                passThreshold={passThreshold}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
