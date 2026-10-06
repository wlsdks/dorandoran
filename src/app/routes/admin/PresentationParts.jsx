import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { pop } from '@/lib/motion';
import { Users, QrCode, X, Hand, MessageSquare, ChevronDown, Trophy, Medal, Coffee, Award, HelpCircle, UserPlus, Zap, Timer } from 'lucide-react';
import { ref, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import QRCode from '@/components/ui/QRCode';
import ParticipationQR from '@/components/ui/ParticipationQR';
import { modeGroups } from '@/lib/modes';
import Badge from '@/components/ui/Badge';
import HandRaiseList from '@/features/hand-raise/components/HandRaiseList';
import UrgentQuestionList from '@/features/questions/components/UrgentQuestionList';
import TimerControls from '@/features/timer/components/TimerControls';
import { useHandRaises } from '@/features/hand-raise/api/useHandRaises';
import { useUrgentQuestions } from '@/features/questions/api/useUrgentQuestions';

/**
 * PresentationView의 순수 표시 컴포넌트 모음 — 컨테이너에서 분리(632→~390줄).
 * 외부 importer가 없고 로직 결합이 적은 leaf만 추출. 키보드/슬라이드/reveal 로직은 컨테이너에 유지.
 */

// 프로젝터 뒷자리에서도 스캔 가능하도록 QR을 화면 크기에 반응해 크게 — 1920→~450px, 2560(QHD)→~560px
function useProjectorQRSize() {
  const [size, setSize] = useState(400);
  useEffect(() => {
    const calc = () => setSize(Math.round(Math.min(Math.max(Math.min(window.innerWidth, window.innerHeight) * 0.42, 300), 560)));
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);
  return size;
}

export function PresentEmptyState({ sessionId, studentUrl, count }) {
  const qrSize = useProjectorQRSize();
  return (
    <div className="flex flex-col items-center justify-center gap-5 md:gap-7 px-2">
      <QRCode url={studentUrl} size={qrSize} />
      <p className="text-slate-500 dark:text-slate-400 text-lg md:text-xl break-all max-w-md md:max-w-2xl text-center">{studentUrl}</p>
      <p className="text-slate-600 dark:text-slate-200 text-lg md:text-2xl font-semibold text-center">학생들이 QR코드를 스캔하여 참여할 수 있습니다</p>
      <div className="flex items-center gap-3 flex-wrap justify-center">
        <Badge variant="neutral" size="xl"><Users size={20} className="mr-2" />{count}명 접속 중</Badge>
        <Badge variant="neutral" size="xl">{sessionId}</Badge>
      </div>
    </div>
  );
}

export function PresentQROverlay({ sessionId, studentUrl, count }) {
  const [open, setOpen] = useState(false);
  return <>
    <button onClick={() => setOpen(true)} aria-label="QR코드 열기" className="presentation-button"><QrCode size={20} /><span>참여 QR</span></button>
    <ParticipationQR open={open} onClose={() => setOpen(false)} url={studentUrl} sessionId={sessionId} count={count} />
  </>;
}

export const GameFallback = () => (
  <div className="flex items-center justify-center min-h-[300px]">
    <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
      <div className="w-5 h-5 border-2 border-slate-300 dark:border-slate-600 border-t-slate-500 dark:border-t-slate-400 rounded-full animate-spin" />
      <span className="text-sm">준비 중...</span>
    </div>
  </div>
);

/** Collapsible panel for HandRaiseList + UrgentQuestionList — always toggleable. */
// 손든 학생·긴급질문 알림 개수 배지 (0이면 숨김)
function NotifBadge({ count }) {
  if (!count) return null;
  return (
    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold tabular-nums shadow ring-2 ring-white dark:ring-slate-900 animate-pulse">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function SideNoticesPanel({ sessionId }) {
  const [open, setOpen] = useState(false);
  const { count: handCount } = useHandRaises(sessionId);
  const { unreadCount: urgentCount } = useUrgentQuestions(sessionId);
  const notifCount = (handCount || 0) + (urgentCount || 0);
  return (
    <>
      {/* Desktop: toggleable top-left panel */}
      <div className="hidden md:block fixed top-5 left-5 z-10">
        <motion.button
          onClick={() => setOpen((v) => !v)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.94 }}
          className="relative flex items-center gap-2 bg-slate-900/80 hover:bg-slate-900 dark:bg-slate-800/90 dark:hover:bg-slate-700 backdrop-blur-sm text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl ring-1 ring-white/10 hover:ring-white/30 transition-all duration-150 mb-2"
          aria-label={`알림 패널 열기/닫기${notifCount ? ` (${notifCount}건)` : ''}`}
        >
          <Hand size={17} />
          <MessageSquare size={17} />
          <ChevronDown size={15} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          {!open && <NotifBadge count={notifCount} />}
        </motion.button>
        <AnimatePresence>
          {open && (
            <motion.div
              {...pop}
              style={{ transformOrigin: 'top left' }}
              className="w-72 space-y-3"
            >
              <HandRaiseList sessionId={sessionId} />
              <UrgentQuestionList sessionId={sessionId} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile: pill toggle at top-left + slide-down sheet */}
      <div className="md:hidden fixed top-3 left-3 z-20">
        <motion.button
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          whileTap={{ scale: 0.94 }}
          className="relative flex items-center gap-1.5 bg-slate-900/80 dark:bg-slate-800/90 backdrop-blur-sm text-white px-3 py-2 rounded-xl text-xs font-medium shadow-lg"
          aria-label={`알림 패널 열기${notifCount ? ` (${notifCount}건)` : ''}`}
        >
          <Hand size={13} />
          <MessageSquare size={13} />
          <ChevronDown size={12} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          {!open && <NotifBadge count={notifCount} />}
        </motion.button>

        <AnimatePresence>
          {open && (
            <motion.div
              key="notices"
              {...pop}
              style={{ transformOrigin: 'top left' }}
              onClick={(e) => e.stopPropagation()}
              className="mt-2 w-[min(calc(100vw-24px),288px)] space-y-2 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 p-3"
            >
              <HandRaiseList sessionId={sessionId} />
              <UrgentQuestionList sessionId={sessionId} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

/** Exit hint + button — ESC on desktop, explicit button on all.
 *  위치는 상위 top-right 클러스터가 담당(타이머 버튼과 정렬). */
export function ExitHint({ onExit }) {
  return (
    <button
      onClick={onExit}
      className="presentation-button"
    >
      <X size={18} />
      <span className="hidden lg:inline">제어 화면</span>
      <span className="hidden xl:inline text-white/50 ml-1">ESC</span>
    </button>
  );
}

/** 타이머 시계 버튼 — 나가기 왼쪽. 클릭 시 프리셋(15/30/60/커스텀) 드롭다운.
 *  기존 상시 노출 패널이 나가기 버튼과 겹치던 문제 해결. */
export function PresentTimerButton({ isRunning, onStart, onStop }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="타이머"
        className={`presentation-button ${
          isRunning
            ? 'bg-indigo-600 hover:bg-indigo-500 text-white ring-1 ring-indigo-400/40'
            : open
              ? 'bg-white text-slate-900 ring-1 ring-slate-200'
              : 'bg-slate-900/80 dark:bg-slate-700/80 hover:bg-slate-900 dark:hover:bg-slate-600 text-white'
        }`}
      >
        <Timer size={18} />
        <span className="hidden lg:inline">{isRunning ? '진행 중' : '타이머'}</span>
      </button>
      <AnimatePresence>
      {open && (
        <motion.div key="timer-menu" {...pop} style={{ transformOrigin: 'top right' }} className="absolute top-full right-0 mt-2 w-64 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-xl p-3 shadow-xl ring-1 ring-white/10">
          <TimerControls
            isRunning={isRunning}
            onStart={(s) => { onStart(s); setOpen(false); }}
            onStop={() => { onStop(); setOpen(false); }}
          />
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}

export function PresentModeMenu({ sessionId, currentMode, currentQuestion, hasLeaderboard = false }) {
  const [open, setOpen] = useState(false);
  // 돌아갈 질문이 있는지 — 렌더에서 ref를 읽지 않도록 상태로 따로 들고 있는다
  const [hasPrevQuestion, setHasPrevQuestion] = useState(false);
  const groups = modeGroups({ hasLeaderboard });
  // 특수 모드 진입 시 직전 질문/모드 기억 — "질문으로 돌아가기"가 실제로 그 질문을 복원.
  // (switchMode가 currentQuestion을 null로 지우므로 기억 없이는 대기화면으로만 떨어짐)
  const prevQuestionRef = useRef(null);

  async function switchMode(mode) {
    if (['poll', 'quiz'].includes(currentMode) && currentQuestion) {
      prevQuestionRef.current = { q: currentQuestion, m: currentMode };
      setHasPrevQuestion(true);
    }
    await update(ref(db, `sessions/${sessionId}`), { currentMode: mode, currentQuestion: null, ...(mode === 'leaderboard' ? { leaderboardPage: 0 } : {}) });
    setOpen(false);
  }

  async function backToQuestion() {
    const prev = prevQuestionRef.current;
    if (prev) {
      // activatedAt은 유지(votes 보존) — 화면만 해당 질문으로 복귀
      await update(ref(db, `sessions/${sessionId}`), { currentMode: prev.m, currentQuestion: prev.q });
    } else {
      await update(ref(db, `sessions/${sessionId}`), { currentMode: 'waiting' });
    }
    setOpen(false);
  }

  return (
    <div className="fixed top-4 left-32 md:top-5 md:left-36 z-30">
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all backdrop-blur-sm shadow-lg active:scale-95 ${
            open ? 'bg-white text-slate-900 shadow-xl ring-1 ring-slate-200' : 'bg-slate-900/80 hover:bg-slate-900 hover:shadow-xl text-white ring-1 ring-white/10 hover:ring-white/30'
          }`}
        >
          <Zap size={16} className={open ? 'text-amber-500' : 'text-amber-400'} />
          모드
        </button>

        <AnimatePresence>
        {open && (
          <motion.div key="mode-menu" {...pop} style={{ transformOrigin: 'top left' }} className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 max-h-[70vh] overflow-y-auto">
            {/* 목록은 lib/modes.js 한 곳에서 온다 — 발표 중에도 대시보드와 같은 모드를 켤 수 있다 */}
            {groups.map((group, gi) => (
              <div key={group.label}>
                {gi > 0 && <div className="border-t border-slate-100 dark:border-slate-700 my-1" />}
                <p className="px-3 pt-1.5 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{group.label}</p>
                {group.items.map(({ mode, label, icon: Icon }) => (
                  <button
                    key={mode}
                    onClick={() => switchMode(mode)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                      currentMode === mode
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>
            ))}
            <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
            <button
              onClick={backToQuestion}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <X size={14} />
              {hasPrevQuestion ? '질문으로 돌아가기' : '대기 화면으로'}
            </button>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
}
