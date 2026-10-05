import { useAIAvailability } from '@/hooks/useAIAvailability';
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Sun, Moon, Search } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useAssignment } from '@/features/assignments/api/useAssignments';
import { ASSIGNMENT_STATUS } from '@/features/assignments/api/useAssignments';
import { submitWork, lookupSubmission, useSubmissionResults } from '@/features/assignments/api/useSubmissions';
import { useAwards } from '@/features/assignments/api/useAwards';
import SubmissionForm from './SubmissionForm';
import SubmissionResult from './SubmissionResult';
import MySubmissionView from './MySubmissionView';
import LookupForm from './LookupForm';
import SubmissionLanding from './SubmissionLanding';
import SubmissionAwardsView from './SubmissionAwardsView';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';

// ─── Main ──────────────────────────────────────────
export default function SubmissionPage({ assignmentId }) {
  const { assignment, loading } = useAssignment(assignmentId);
  const { available } = useAIAvailability();
  const { awards } = useAwards(assignmentId);
  // 'landing' | 'submit' | 'lookup' | 'mySubmission' | 'edit' | 'result' | 'awardsView'
  const [view, setView] = useState('landing');
  const [foundSubmission, setFoundSubmission] = useState(null);
  const [lookupName, setLookupName] = useState('');
  const [lookupPin, setLookupPin] = useState('');
  const [resultLookupLoading, setResultLookupLoading] = useState(false);
  const [resultLookupError, setResultLookupError] = useState('');

  const { results } = useSubmissionResults(
    view === 'result' && available ? assignmentId : null,
    foundSubmission?.id
  );

  const handleSubmit = useCallback(async (data, { isEdit } = {}) => {
    await submitWork(assignmentId, data, { allowUpdate: !!isEdit });
  }, [assignmentId]);

  const { isDark, setTheme } = useTheme();

  const handleResultLookup = useCallback(async () => {
    if (!lookupName.trim() || ! /^(?:\d{4}|\d{8})$/.test(lookupPin)) return;
    setResultLookupLoading(true);
    setResultLookupError('');
    try {
      const result = await lookupSubmission(assignmentId, lookupName.trim(), lookupPin);
      if (result.error === 'NOT_FOUND') {
        setResultLookupError('해당 이름의 제출물을 찾을 수 없습니다. 제출 시 입력한 이름을 정확히 입력해주세요.');
      } else if (result.error === 'PIN_MISMATCH') {
        setResultLookupError('이름 또는 조회용 비밀번호를 확인해주세요.');
      } else {
        setFoundSubmission(result.submission);
        setView('result');
      }
    } catch {
      setResultLookupError('조회하지 못했어요. 연결을 확인하고 다시 시도해주세요.');
    } finally {
      setResultLookupLoading(false);
    }
  }, [assignmentId, lookupName, lookupPin]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="animate-pulse text-slate-400 text-sm">불러오는 중...</div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6">
        <DoranDoranMascot size="lg" mood="waiting" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mt-6">과제를 찾을 수 없습니다</h2>
        <p className="text-slate-400 text-sm mt-2">강사에게 과제 링크를 다시 확인해주세요</p>
        <a href="/" className="min-h-12 mt-4 px-5 inline-flex items-center justify-center rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900">수업 참여 화면으로</a>
      </div>
    );
  }

  const isJudged = assignment.status === 'judged';
  const isOpen = assignment.status === 'open';
  const isJudging = assignment.status === 'judging';
  const isClosed = assignment.status === 'closed';
  const statusLabel = !available && ['judged','judging'].includes(assignment.status) ? '제출 마감' : ASSIGNMENT_STATUS[assignment.status] || assignment.status;
  const showBackButton = view !== 'landing';

  function handleBack() {
    if (view === 'edit') setView('mySubmission');
    else { setView('landing'); setFoundSubmission(null); }
  }

  function toggleTheme() {
    setTheme(isDark ? 'light' : 'dark');
  }

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-3">
          {showBackButton && (
            <button onClick={handleBack} aria-label="이전 화면"
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center -ml-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight line-clamp-2">
              {assignment.title}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {assignment.courseName}{assignment.roundNumber ? ` · ${assignment.roundNumber}차` : ''}
            </p>
          </div>
          <button
            onClick={toggleTheme}
            className="inline-flex h-12 w-12 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0"
            aria-label={isDark ? '라이트 모드' : '다크 모드'}
            title={isDark ? '라이트 모드' : '다크 모드'}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium ${
            isJudged ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
            : isOpen ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            : isJudging ? 'bg-slate-100 dark:bg-slate-700 text-slate-500'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
          }`}>
            {statusLabel}
          </span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-5 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <AnimatePresence mode="wait">

          {/* ── 랜딩: 선택 화면 ── */}
          {view === 'landing' && (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <SubmissionLanding
                assignment={assignment}
                isOpen={isOpen}
                isJudged={isJudged && available}
                isJudging={isJudging && available}
                isClosed={isClosed || (!available && (isJudged || isJudging))}
                awards={awards}
                lookupName={lookupName}
                lookupPin={lookupPin}
                resultLookupError={resultLookupError}
                resultLookupLoading={resultLookupLoading}
                onLookupNameChange={(v) => { setLookupName(v); setResultLookupError(''); }}
                onLookupPinChange={(v) => { setLookupPin(v); setResultLookupError(''); }}
                onResultLookup={handleResultLookup}
                onSubmit={() => setView('submit')}
                onLookup={() => setView('lookup')}
                onAwardsView={() => setView('awardsView')}
              />
            </motion.div>
          )}

          {/* ── 제출 폼 ── */}
          {view === 'submit' && (
            <motion.div
              key="submit"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <SubmissionForm onSubmit={handleSubmit} assignmentId={assignmentId} />
            </motion.div>
          )}

          {/* ── 내 제출물 조회 ── */}
          {view === 'lookup' && (
            <motion.div
              key="lookup"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex flex-col items-center mb-8">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <Search size={20} className="text-slate-400" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight mt-4">내 제출물 조회</h2>
                <p className="text-sm text-slate-400 mt-1">제출 시 입력한 이름과 조회용 비밀번호를 입력하세요</p>
              </div>
              <LookupForm
                assignmentId={assignmentId}
                onFound={(sub) => { setFoundSubmission(sub); setView('mySubmission'); }}
              />
            </motion.div>
          )}

          {/* ── 내 제출물 확인 ── */}
          {view === 'mySubmission' && foundSubmission && (
            <motion.div
              key="mySubmission"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <MySubmissionView
                submission={foundSubmission}
                assignmentId={assignmentId}
                isOpen={isOpen}
                onBack={() => { setView('landing'); setFoundSubmission(null); }}
                onEdit={() => setView('edit')}
              />
            </motion.div>
          )}

          {/* ── 수정 모드 ── */}
          {view === 'edit' && foundSubmission && (
            <motion.div
              key="edit"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <SubmissionForm onSubmit={handleSubmit} assignmentId={assignmentId} existingSubmission={foundSubmission} />
            </motion.div>
          )}

          {/* ── 심사 결과 ── */}
          {view === 'result' && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {available ? <SubmissionResult submission={foundSubmission} results={results} awards={awards} passThreshold={assignment?.passThreshold ?? 3} /> : <MySubmissionView submission={foundSubmission} assignmentId={assignmentId} isOpen={isOpen} onBack={handleBack} onEdit={() => setView('edit')} />}
            </motion.div>
          )}

          {/* ── 시상 결과 (학생용) ── */}
          {view === 'awardsView' && available && awards && (
            <motion.div
              key="awardsView"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <SubmissionAwardsView awards={awards} />
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
