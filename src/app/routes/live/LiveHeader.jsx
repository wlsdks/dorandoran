import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Maximize, Minimize, QrCode, Hand, AlertCircle } from 'lucide-react';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import Badge from '@/components/ui/Badge';
import ParticipationQR from '@/components/ui/ParticipationQR';
import ElapsedTime from '@/components/ui/ElapsedTime';
import { usePresentationScreen } from '@/hooks/usePresentationScreen';

export default memo(function LiveHeader({ courseName, roundNumber, count, handCount = 0, urgentCount = 0, sessionId, startedAt, status }) {
  const { isFullscreen, toggleFullscreen, fullscreenSupported } = usePresentationScreen();
  const [qrOpen, setQrOpen] = useState(false);
  const studentUrl = sessionId ? `${window.location.origin}/?s=${sessionId}` : '';

  return (
    <header className="flex items-center justify-between px-3 sm:px-6 py-3 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-b border-slate-200/50 dark:border-slate-700/50 relative gap-2">
      <div className="flex items-center gap-2 shrink-0">
        <DoranDoranMascot size="xs" />
        <span className="hidden sm:inline text-slate-900 dark:text-slate-100 font-bold text-lg tracking-tight">도란도란</span>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 justify-center">
        {courseName && (
          <span className="text-slate-500 dark:text-slate-300 text-sm sm:text-base font-medium truncate min-w-0 max-w-[400px]">
            {courseName}
          </span>
        )}
        {roundNumber && (
          <Badge variant="neutral">
            {roundNumber}차
          </Badge>
        )}
        <span className="hidden sm:inline-flex"><ElapsedTime startedAt={startedAt} status={status} /></span>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {fullscreenSupported && <button onClick={toggleFullscreen} aria-label={isFullscreen ? '전체화면 해제' : '전체화면 보기'}
          className="h-12 w-12 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-100 transition-colors">
          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>}
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        {/* P1-4: 손들기/긴급질문 카운트 — 강사 호명용. 명단은 프라이버시상 미노출 */}
        {handCount > 0 && (
          <motion.span
            key={`hand-${handCount}`}
            initial={{ opacity: 0.6, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold tabular-nums"
            aria-label={`손든 학생 ${handCount}명`}
          >
            <Hand size={14} className="text-slate-500 dark:text-slate-400" />
            {handCount}
          </motion.span>
        )}
        {urgentCount > 0 && (
          <motion.span
            key={`urgent-${urgentCount}`}
            initial={{ opacity: 0.6, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm font-semibold tabular-nums"
            aria-label={`읽지 않은 긴급 질문 ${urgentCount}건`}
          >
            <AlertCircle size={14} />
            {urgentCount}
          </motion.span>
        )}
        <Users size={16} className="text-slate-400" />
        <motion.span
          key={count}
          initial={{ opacity: 0.6, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="text-slate-900 dark:text-slate-100 font-bold text-xl tabular-nums tracking-tight"
        >
          {count}
        </motion.span>
        <span className="text-slate-400 dark:text-slate-500 text-sm">명</span>
        {studentUrl && (
          <button
            onClick={() => setQrOpen(v => !v)}
            className={`h-12 w-12 flex items-center justify-center rounded-lg transition-colors ${
              qrOpen
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
            title="QR 코드" aria-label="참여 QR 보기"
          >
            <QrCode size={16} />
          </button>
        )}
      </div>

      <ParticipationQR open={qrOpen} onClose={() => setQrOpen(false)} url={studentUrl} sessionId={sessionId} count={count} />
    </header>
  );
});
