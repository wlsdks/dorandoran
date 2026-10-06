import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useAssignment, useAssignmentActions, ASSIGNMENT_STATUS } from '@/features/assignments/api/useAssignments';
import { useSubmissionList } from '@/features/assignments/api/useSubmissions';
import { useAllResults, useAwards } from '@/features/assignments/api/useAwards';
import Button from '@/components/ui/Button';
import SubmissionsView from './SubmissionsView';
import JudgeView from './JudgeView';
import AwardsView from './AwardsView';
import AssignmentEditForm from './AssignmentEditForm';

const TABS_WITH_JUDGING = [
  { key: 'submissions', label: '제출물' },
  { key: 'judge', label: 'AI 심사' },
  { key: 'awards', label: '시상' },
];

const TABS_WITHOUT_JUDGING = [
  { key: 'submissions', label: '제출물' },
];

// ─── Main ──────────────────────────────────────────
export default function AssignmentDetail({ assignmentId, onBack }) {
  const { assignment } = useAssignment(assignmentId);
  const { submissions } = useSubmissionList(assignmentId);
  const { results } = useAllResults(assignmentId);
  const { awards, loading: awardsLoading } = useAwards(assignmentId);
  const { closeAssignment, reopenAssignment, updateAssignment } = useAssignmentActions();
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('submissions');
  const [confirmClose, setConfirmClose] = useState(false);

  const hasResults = Object.keys(results).length > 0;
  const hasJudging = assignment?.hasJudging !== false; // 기본값 true (하위 호환)
  const passThreshold = assignment?.passThreshold ?? 3; // 기본 3 (하위 호환)
  const TABS = hasJudging ? TABS_WITH_JUDGING : TABS_WITHOUT_JUDGING;

  if (!assignment) return null;

  const statusLabel = ASSIGNMENT_STATUS[assignment.status] || assignment.status;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
    >
      <div className="mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          <span>과제 목록</span>
        </button>

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
                {assignment.title}
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
                {statusLabel}
              </span>
              {assignment.status === 'open' && submissions.length > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 shrink-0">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  {submissions.length}건 제출
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {assignment.courseName}{assignment.roundNumber ? ` · ${assignment.roundNumber}차` : ''}
              {assignment.description && assignment.description !== assignment.title ? ` — ${assignment.description}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!editing && <Button onClick={() => setEditing(true)} variant="ghost" size="sm">수정</Button>}
            {assignment.status === 'open' && !confirmClose && (
              <Button onClick={() => setConfirmClose(true)} variant="secondary" size="sm">마감</Button>
            )}
            {/* 마감만 된 과제는 다시 열 수 있다. 심사가 시작된 뒤에는 결과가 어긋나지 않게 막는다. */}
            {assignment.status === 'closed' && (
              <Button onClick={() => reopenAssignment(assignmentId)} variant="secondary" size="sm">다시 열기</Button>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <AssignmentEditForm assignment={assignment} onCancel={() => setEditing(false)}
          onSave={async (data) => { await updateAssignment(assignmentId, data); setEditing(false); }} />
      )}

      {confirmClose && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 mb-6">
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">마감하면 학생들이 더 이상 제출할 수 없습니다</p>
          <div className="flex items-center gap-2 justify-end">
            <Button onClick={() => setConfirmClose(false)} variant="ghost" size="sm">취소</Button>
            <Button onClick={() => { closeAssignment(assignmentId); setConfirmClose(false); }} variant="danger" size="sm">마감하기</Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-6 border-b border-slate-200 dark:border-slate-700 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); window.scrollTo(0, 0); }}
            className={`px-3 py-2 pb-3 text-sm font-medium transition-colors relative ${
              activeTab === tab.key
                ? 'text-slate-900 dark:text-slate-100'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 dark:bg-slate-100 rounded-full"
              />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === 'submissions' && (
            <SubmissionsView
              assignmentId={assignmentId}
              submissions={submissions}
              results={results}
              awards={awards}
              hasResults={hasResults}
              passThreshold={passThreshold}
            />
          )}
          {activeTab === 'judge' && (
            <JudgeView
              assignmentId={assignmentId}
              submissions={submissions}
              results={results}
              hasResults={hasResults}
              passThreshold={passThreshold}
            />
          )}
          {activeTab === 'awards' && (
            <AwardsView assignmentId={assignmentId} awards={awards} awardsLoading={awardsLoading} hasResults={hasResults} />
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
