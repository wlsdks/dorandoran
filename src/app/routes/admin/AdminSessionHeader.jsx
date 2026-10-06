import { useState, useEffect, useMemo, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ConfirmModal from '@/components/ui/ConfirmModal';
import TimerControls from '@/features/timer/components/TimerControls';
import TimerRing from '@/features/timer/components/TimerRing';
import { ArrowLeft, Clock, MessageCircle, Users, UserCog, Monitor, Play, Square, Layers, List, Zap, MessageSquareDot, XCircle, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { lazy, Suspense } from 'react';

const CourseStaffModal = lazy(() => import('./CourseStaffModal'));

function formatElapsed(ms) {
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  if (hours > 0) return `${hours}시간 ${mins}분 경과`;
  return `${mins}분 경과`;
}

function ElapsedTime({ startedAt, createdAt, status }) {
  const [now, setNow] = useState(() => Date.now());
  const origin = startedAt || createdAt;

  useEffect(() => {
    if (!origin || status !== 'active') return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [origin, status]);

  if (!origin || status !== 'active') return null;

  const elapsed = Math.max(0, now - origin);
  if (elapsed < 60_000) return null;

  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
      <span className="text-slate-500 dark:text-slate-400">&middot;</span>
      <Clock size={12} className="text-slate-500 dark:text-slate-400" />
      <span className="tabular-nums">{formatElapsed(elapsed)}</span>
    </span>
  );
}

function ReviewingCountdown({ reviewingUntil }) {
  // day 단위 표시 — mount 시 한 번 + reviewingUntil 변경 시만 재계산. 수시간 이내 변동은 무시 가능

  const remaining = useMemo(() => Math.max(0, reviewingUntil - Date.now()), [reviewingUntil]);
  const days = Math.ceil(remaining / (24 * 60 * 60 * 1000));
  if (days <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
      <span className="text-slate-500 dark:text-slate-400">&middot;</span>
      <MessageSquareDot size={12} className="text-slate-500 dark:text-slate-400" />
      <span>{days}일 후 자동 종료</span>
    </span>
  );
}

export default memo(function AdminSessionHeader({
  session,
  sessionId,
  effectiveReadOnly,
  isSetting,
  questionProgress,
  count,
  chatOpen,
  hasUnreadChat,
  onChatToggle,
  timerRunning,
  endTime,
  duration,
  onTimerStart,
  onTimerStop,
  onTimerExpire,
  onBack,
  onStartSession,
  onEndSession,
  onPresentMode,
  isTablet = false,
  onLeftDrawer,
  onRightDrawer,
  speedQuizActive = false,
  isReviewing = false,
  onFullEndSession,
  courseId,
  courseName,
}) {
  const [timerOpen, setTimerOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(null);
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const timerRef = useRef(null);
  const { isDark, setTheme } = useTheme();

  // Close timer popup on outside click
  useEffect(() => {
    if (!timerOpen) return;
    function handleClick(e) {
      if (timerRef.current && !timerRef.current.contains(e.target)) setTimerOpen(false);
    }
    function handleEscape(event) {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation();
      setTimerOpen(false);
      timerRef.current?.querySelector('button')?.focus();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape, true);
    };
  }, [timerOpen]);

  return (
    <div className={`bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0 ${isTablet ? 'px-3 py-3' : 'px-6 py-4'}`}>
      <div className="flex items-center gap-2 lg:gap-3 min-w-0">
        {/* Tablet: questions drawer toggle */}
        {isTablet && onLeftDrawer && (
          <button
            onClick={onLeftDrawer}
            className="h-12 w-12 flex items-center justify-center -ml-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors duration-150 active:scale-90"
            aria-label="질문 목록 열기"
          >
            <List size={20} />
          </button>
        )}
        <button
          onClick={onBack}
          className={`h-12 w-12 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors duration-150 active:scale-90 ${isTablet ? '' : '-ml-2'}`}
          aria-label="클래스 목록으로"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
              {session?.courseName || '도란도란'}
            </span>
            {session?.roundNumber && (
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400 shrink-0">{session.roundNumber}차</span>
            )}
            {isReviewing && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-800 dark:bg-slate-600 text-white rounded text-[11px] font-bold"
              >
                <MessageSquareDot size={10} />
                질문 받기 중
              </motion.div>
            )}
            {effectiveReadOnly && !isReviewing && <Badge variant="neutral">클래스 확인</Badge>}
            {isSetting && <Badge variant="neutral">세팅중</Badge>}
            {speedQuizActive && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-900 dark:bg-slate-600 text-white rounded text-[11px] font-bold"
              >
                <Zap size={10} />
                스피드
              </motion.div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isTablet && (
              <span className="text-xs text-slate-500 dark:text-slate-400">세션 <span className="font-mono">{sessionId}</span></span>
            )}
            {questionProgress && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                {!isTablet && <span className="text-slate-500 dark:text-slate-400">&middot;</span>}
                <Layers size={12} className="text-slate-500 dark:text-slate-400" />
                {questionProgress.current ? (
                  <span className="tabular-nums">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">{questionProgress.current}</span>
                    <span className="text-slate-500 dark:text-slate-400">/{questionProgress.total}</span>
                  </span>
                ) : (
                  <span>{questionProgress.total}개</span>
                )}
              </span>
            )}
            {!isTablet && !isReviewing && (
              <ElapsedTime startedAt={session?.startedAt} createdAt={session?.createdAt} status={session?.status} />
            )}
            {isReviewing && session?.reviewingUntil && (
              <ReviewingCountdown reviewingUntil={session.reviewingUntil} />
            )}
          </div>
        </div>
      </div>
      <div className={`flex items-center shrink-0 ${isTablet ? 'gap-1' : 'gap-3'}`}>
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="relative h-12 min-w-12 flex flex-col items-center justify-center gap-0.5 px-2.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors duration-150 active:scale-[0.96]"
          aria-label={isDark ? '라이트 모드' : '다크 모드'}
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
          {!isTablet && <span className="text-[10px] font-medium">{isDark ? '라이트' : '다크'}</span>}
        </button>

        {/* Staff manage button */}
        {courseId && !effectiveReadOnly && (
          <button
            onClick={() => setStaffModalOpen(true)}
            className="relative h-12 min-w-12 flex flex-col items-center justify-center gap-0.5 px-2.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors duration-150 active:scale-[0.96]"
            aria-label="스태프 관리"
          >
            <UserCog size={20} />
            {!isTablet && <span className="text-[10px] font-medium">스태프</span>}
          </button>
        )}

        {/* Chat button */}
        {!effectiveReadOnly && (
          <button
            onClick={onChatToggle}
            className="relative h-12 min-w-12 flex flex-col items-center justify-center gap-0.5 px-2.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors duration-150 active:scale-[0.96]"
            aria-label={chatOpen ? '채팅 닫기' : '채팅 열기'}
            aria-pressed={chatOpen}
          >
            <MessageCircle size={20} />
            {!isTablet && <span className="text-[10px] font-medium">채팅</span>}
            {hasUnreadChat && !chatOpen && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500" />
            )}
          </button>
        )}
        {/* Timer button */}
        {!effectiveReadOnly && (
          <div className="relative" ref={timerRef}>
            <button
              onClick={() => setTimerOpen(!timerOpen)}
              className={`h-12 min-w-12 flex flex-col items-center justify-center gap-0.5 px-2.5 rounded-lg transition-colors duration-150 active:scale-[0.96] ${
                timerRunning ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-700'
              }`}
              aria-label={timerRunning ? '타이머 진행 중 - 설정 열기' : '타이머 설정'}
              aria-expanded={timerOpen}
            >
              {timerRunning ? (
                <TimerRing endTime={endTime} duration={duration} onExpire={onTimerExpire} size="sm" />
              ) : (
                <>
                  <Clock size={20} />
                  {!isTablet && <span className="text-[10px] font-medium">타이머</span>}
                </>
              )}
            </button>
            <AnimatePresence>
              {timerOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-4 z-50 w-72"
                >
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">타이머 설정</p>
                  <TimerControls isRunning={timerRunning} onStart={(s) => { onTimerStart(s); setTimerOpen(false); }} onStop={onTimerStop} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        {/* Tablet: participants drawer toggle (replaces count badge) */}
        {isTablet && onRightDrawer ? (
          <button
            onClick={onRightDrawer}
            className="h-12 min-w-12 flex items-center justify-center gap-1.5 px-2.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors duration-150 active:scale-[0.96]"
            aria-label="참여자 패널 열기"
          >
            <Users size={20} />
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 tabular-nums">{count}</span>
          </button>
        ) : (
          <Badge variant="neutral" className="h-12 px-3.5 text-sm tabular-nums">
            <Users size={20} className="mr-1.5" />
            <motion.span key={count} initial={{ scale: 1.2 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }} className="inline-block">{count}</motion.span>명
          </Badge>
        )}
        {!effectiveReadOnly && isSetting && (
          <Button onClick={onStartSession} variant="primary" size="sm" className="h-12">
            <Play size={20} />
            {isTablet ? '시작' : '시작하기'}
          </Button>
        )}
        {!effectiveReadOnly && !isSetting && (
          <>
            <Button onClick={onPresentMode} variant="primary" size="sm" className="h-12">
              <Monitor size={20} />
              {isTablet ? '발표' : '발표 모드'}
            </Button>
            <Button onClick={() => setConfirmEnd('end')} variant="secondary" size="sm" className="h-12">
              <Square size={20} />
              종료
            </Button>
          </>
        )}
        {isReviewing && (
          <>
            <Button onClick={onPresentMode} variant="primary" size="sm" className="h-12">
              <Monitor size={20} />
              {isTablet ? '결과' : '결과 보기'}
            </Button>
            <Button onClick={() => setConfirmEnd('fullEnd')} variant="secondary" size="sm" className="h-12">
              <XCircle size={20} />
              {isTablet ? '종료' : '완전 종료'}
            </Button>
          </>
        )}
      </div>

      <ConfirmModal
        open={confirmEnd === 'end'}
        title="수업을 종료하시겠습니까?"
        description={"학생들은 결과를 확인하고, 질문을 보낼 수 있습니다.\n14일 후 자동으로 완전 종료됩니다."}
        onConfirm={() => { onEndSession(); setConfirmEnd(null); }}
        onCancel={() => setConfirmEnd(null)}
      />
      <ConfirmModal
        open={confirmEnd === 'fullEnd'}
        title="완전 종료하시겠습니까?"
        description="학생들은 더 이상 질문을 보낼 수 없습니다."
        variant="danger"
        confirmLabel="완전 종료"
        onConfirm={() => { onFullEndSession(); setConfirmEnd(null); }}
        onCancel={() => setConfirmEnd(null)}
      />

      {courseId && staffModalOpen && (
        <Suspense fallback={null}>
          <CourseStaffModal open={staffModalOpen} onClose={() => setStaffModalOpen(false)} courseId={courseId} courseName={courseName} />
        </Suspense>
      )}
    </div>
  );
});
