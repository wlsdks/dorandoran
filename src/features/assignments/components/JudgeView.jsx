import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { spring } from '@/lib/motion';
import { ChevronRight, X } from 'lucide-react';
import { JUDGES } from '@/lib/judging/judges';
import Modal from '@/components/ui/Modal';
import JudgingPanel from './JudgingPanel';
import JudgeResultCard from './JudgeResultCard';
import Avatar from '@/components/ui/Avatar';

/** Sort submissions by avgScore descending. */
function sortByScore(submissions, results) {
  return [...submissions].sort((a, b) => {
    const ra = results[a.id]?.summary?.avgScore || 0;
    const rb = results[b.id]?.summary?.avgScore || 0;
    return rb - ra;
  });
}

// ─── Judge Tab ─────────────────────────────────────
export default function JudgeView({ assignmentId, submissions, results, hasResults, passThreshold = 3 }) {
  const sorted = useMemo(() => sortByScore(submissions, results), [submissions, results]);
  const [selectedSub, setSelectedSub] = useState(null);

  const selectedResult = selectedSub ? results[selectedSub.id] : null;
  const isPassed = (summary) => (summary?.selectedCount ?? 0) >= passThreshold;

  return (
    <div className="space-y-6">
      {/* 심사위원단 */}
      <div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">심사위원단</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {JUDGES.map((judge) => (
            <div
              key={judge.id}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-3.5"
            >
              <div className="flex items-center gap-2.5">
                <Avatar name={judge.name} size="sm" />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">{judge.name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{judge.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 심사 컨트롤 */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5">
        <JudgingPanel assignmentId={assignmentId} submissionCount={submissions.length} passThreshold={passThreshold} />
      </div>

      {/* 순위 — 클릭 시 심사평 모달 */}
      {hasResults && (
        <div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">순위</p>
          <div className="space-y-2">
            {sorted.map((sub, i) => {
              const r = results[sub.id];
              if (!r) return null;
              return (
                <motion.button
                  key={sub.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...spring.default, delay: i * 0.04 }}
                  onClick={() => setSelectedSub(sub)}
                  className="w-full flex items-center gap-3 p-4 text-left bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-150 active:scale-[0.99]"
                >
                  <span className={`text-sm font-bold tabular-nums w-6 text-center shrink-0 ${
                    i === 0 ? 'text-slate-900 dark:text-slate-100'
                    : i < 3 ? 'text-slate-600 dark:text-slate-300'
                    : 'text-slate-300 dark:text-slate-500'
                  }`}>{i + 1}</span>
                  <Avatar name={sub.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-slate-900 dark:text-slate-100 truncate">{sub.name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {isPassed(r.summary) ? '합격' : '불합격'} · {r.summary.selectedCount}/{r.summary.totalJudges}명 선택
                    </p>
                  </div>
                  <motion.span
                    key={String(r.summary.avgScore)}
                    initial={{ scale: 0.85, opacity: 0.5 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={spring.bouncy}
                    className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums shrink-0"
                  >
                    {r.summary.avgScore}
                  </motion.span>
                  <ChevronRight size={16} className="text-slate-300 shrink-0" />
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* 심사평 모달 */}
      <Modal
        open={!!selectedSub}
        onClose={() => setSelectedSub(null)}
        ariaLabel="심사평 상세"
        className="!max-w-lg !max-h-[80vh] !overflow-y-auto"
      >
        {selectedSub && selectedResult && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">{selectedSub.name}</h3>
                <p className="text-sm text-slate-400 mt-0.5">
                  평균 {selectedResult.summary.avgScore}점 · {selectedResult.summary.selectedCount}/{selectedResult.summary.totalJudges}명 선택
                  · {isPassed(selectedResult.summary) ? '합격' : '불합격'}
                </p>
              </div>
              <button onClick={() => setSelectedSub(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              {JUDGES.map((judge) => (
                <JudgeResultCard key={judge.id} judge={judge} result={selectedResult.judges?.[judge.id]} />
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
