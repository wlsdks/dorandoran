import { useState, lazy, Suspense } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { HelpCircle, FileText, Copy, Check } from 'lucide-react';
import StudentHeader from './StudentHeader';
import StudentBottomBar from './StudentBottomBar';
import ClassQAPanel from '@/features/class-questions/components/ClassQAPanel';
import SessionSummaryCard from '@/features/session/components/SessionSummaryCard';
import { getParticipantId } from '@/lib/participant';

const ConfettiBurst = lazy(() => import('@/components/ui/ConfettiBurst'));

export default function SessionEndedPage({ sessionId, session, reviewing = false }) {
  const reducedMotion = useReducedMotion();
  const [showQA, setShowQA] = useState(false);
  const [copied, setCopied] = useState(false);
  const isEnded = session?.status === 'ended';
  const participantId = getParticipantId();
  const reportUrl = `${window.location.origin}/report?s=${sessionId}&p=${participantId}`;

  async function handleCopyReport() {
    try {
      await navigator.clipboard.writeText(reportUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }

  return (
    <div className={`min-h-dvh w-full max-w-full bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4 pt-20 ${reviewing || isEnded ? 'pb-36' : 'pb-8'}`}>
      <StudentHeader sessionId={sessionId} />

      {/* Confetti on session end */}
      {isEnded && (
        <Suspense fallback={null}>
          <ConfettiBurst />
        </Suspense>
      )}

      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="w-full min-w-0 max-w-xl [overflow-wrap:anywhere] [word-break:keep-all]"
      >
        <SessionSummaryCard session={session} sessionId={sessionId} reviewing={reviewing} />
      </motion.div>

      {/* Report link buttons */}
      {(reviewing || isEnded) && (
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 300, damping: 25 }}
          className="w-full min-w-0 max-w-xl mx-auto mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-2 px-1"
        >
          <a
            href={reportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 min-h-12 flex items-center justify-center gap-2 px-2 py-3 bg-white dark:bg-slate-700 rounded-xl shadow-sm text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors duration-150"
          >
            <FileText size={16} />
            내 학습 리포트
          </a>
          <button
            onClick={handleCopyReport}
            className="flex items-center justify-center gap-2 min-h-12 px-3 py-3 bg-white dark:bg-slate-700 rounded-xl shadow-sm text-sm font-medium text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors duration-150"
          >
            {copied ? <Check size={16} className="text-slate-900 dark:text-slate-100" /> : <Copy size={16} />}
            {copied ? '복사됨' : '링크 복사'}
          </button>
        </motion.div>
      )}

      {/* reviewing: full bottom bar (chat + questions) */}
      {reviewing && <StudentBottomBar sessionId={sessionId} />}

      {/* ended: question-only floating button (사후 질문) */}
      {isEnded && (
        <>
          <motion.button
            initial={reducedMotion ? false : { opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.6, type: 'spring', stiffness: 300, damping: 25 }}
            whileHover={{ scale: reducedMotion ? 1 : 1.04 }}
            whileTap={{ scale: reducedMotion ? 1 : 0.95 }}
            onClick={() => setShowQA(true)}
            className="fixed bottom-6 right-5 flex items-center gap-2 px-5 py-3 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-lg text-sm font-semibold z-30 active:shadow-md transition-shadow"
            style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
          >
            <HelpCircle size={18} />
            질문하기
          </motion.button>
          <ClassQAPanel sessionId={sessionId} open={showQA} onClose={() => setShowQA(false)} />
        </>
      )}
    </div>
  );
}
