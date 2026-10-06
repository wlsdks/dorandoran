import { useState, useEffect, useCallback, useRef, memo, lazy, Suspense } from 'react';
import { motion, AnimatePresence, MotionConfig, useReducedMotion } from 'framer-motion';
import { Users, Trophy, Copy, Check, Gift, Coffee, UserCircle, Award, Mic } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import QuizEventBanner from '@/components/ui/QuizEventBanner';
import StudentHeader from './StudentHeader';
import StudentBottomBar from './StudentBottomBar';
import IdleMascot from './IdleMascot';
import WaitingLive from './WaitingLive';
import { getNickname } from '@/lib/participant';
import { waitingStatus } from '@/lib/waiting-room';
import ReviewingBanner from '@/components/ui/ReviewingBanner';
import { useGameResult } from '@/features/games/api/useGameResult';
import BreakStatus from '@/features/games/components/BreakStatus';
import PersistentAssignmentCard from '@/features/ai-judge/components/PersistentAssignmentCard';
const ConfettiBurst = lazy(() => import('@/components/ui/ConfettiBurst'));
const SPRING = { type: 'spring', stiffness: 300, damping: 25 };

/** 느리게 숨 쉬는 점 세 개 — "기다리는 중"의 유일한 반복 모션. 움직임 줄이기에서는 멈춘다. */
function BreathingDots({ className = '' }) {
  const reduced = useReducedMotion();
  return <span className={`inline-flex items-center gap-1 ${className}`} aria-hidden="true">
    {[0, 1, 2].map(i => <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500"
      animate={reduced ? { opacity: 0.6 } : { opacity: [0.25, 1, 0.25] }} transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.25, ease: 'easeInOut' }} />)}
  </span>;
}

/** Session code badge with copy-to-clipboard. */
function CopyableCode({ code }) {
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef(null);
  const copyScope = useRef(null);
  useEffect(() => {
    const scope = { active: true };
    copyScope.current = scope;
    return () => { scope.active = false; clearTimeout(copiedTimer.current); };
  }, []);
  const handleCopy = useCallback(async () => {
    const scope = copyScope.current;
    try {
      await navigator.clipboard.writeText(code);
      if (!scope?.active || copyScope.current !== scope) return;
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard not available */ }
  }, [code]);
  return <button onClick={handleCopy} className="inline-flex max-w-full min-w-0 items-center gap-1.5 min-h-11 px-3.5 py-2 rounded-full text-[13px] font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 active:bg-slate-200/70 dark:hover:bg-slate-800 dark:active:bg-slate-700 transition-colors duration-100 active:scale-[0.97]" aria-label="세션 코드 복사">
    <span className="text-slate-400 dark:text-slate-500">수업 코드</span>
    <span className="min-w-0 truncate tabular-nums text-slate-700 dark:text-slate-200" title={code}>{code}</span>
    <AnimatePresence mode="wait">
      {copied
        ? <motion.span key="check" className="shrink-0" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}><Check size={12} className="text-emerald-500" /></motion.span>
        : <motion.span key="copy" className="shrink-0" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}><Copy size={12} /></motion.span>}
    </AnimatePresence>
  </button>;
}

/** 당첨자를 학생 화면에 알리는 모드 — 추첨 계열과 발표자 뽑기. */
const RESULT_MODES = ['lottery', 'scratchCard', 'randomPicker'];
const GAME_MODES = {
  lottery: { label: '추첨 진행 중', icon: Gift },
  scratchCard: { label: '즉석복권 추첨 중', icon: Gift },
  breakTime: { label: '쉬는 시간', icon: Coffee },
  qaBoard: { label: 'Q&A 보드 진행 중', icon: Users },
  randomPicker: { label: '발표자 뽑기 진행 중', icon: UserCircle },
  awards: { label: '시상식 진행 중', icon: Award },
  joinShow: { label: '참여자 확인 중', icon: Users },
};

/** 지금 상태 한 줄 — 실제 세션 값만 근거로 한다. */
function WaitingStatusLine({ sessionId, currentMode, pendingEvent }) {
  if (currentMode === 'breakTime') return <BreakStatus sessionId={sessionId} />;
  const game = GAME_MODES[currentMode];
  if (game) {
    const Icon = game.icon;
    return <div role="status" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white dark:bg-slate-800 shadow-sm ring-1 ring-slate-200/70 dark:ring-slate-700/60 text-slate-600 dark:text-slate-300 text-sm font-medium">
      <Icon size={16} className="text-slate-400" aria-hidden="true" /><span>{game.label}</span><BreathingDots className="ml-0.5" />
    </div>;
  }
  const status = waitingStatus({ currentMode, currentQuestion: null, pendingEvent });
  return <p role="status" className="inline-flex items-center gap-2 text-base text-slate-600 dark:text-slate-300">
    <span className={status === 'soon' ? 'font-semibold text-slate-900 dark:text-slate-100' : ''}>{status === 'soon' ? '곧 다음 문제가 나와요' : '다음 활동을 기다리는 중'}</span><BreathingDots />
  </p>;
}

export default memo(function WaitingPage({ sessionId, pendingEvent = null, courseName = null, currentMode = null, persistentAssignmentId = null, persistentAssignmentTitle = null }) {
  const nickname = getNickname();
  const { isWinner, winnerNames, gameResult } = useGameResult(sessionId);

  // 결과 표시 — 추첨(lottery/scratchCard)·발표자 뽑기(randomPicker) 공용. 모드 전환 잔재 노출 방지로 mode 일치 요구.
  const isPickerResult = currentMode === 'randomPicker';
  const showsWinner = RESULT_MODES.includes(currentMode);
  const showGameResult = gameResult && gameResult.mode === currentMode && showsWinner;

  // 당첨/지목 본인 풀스크린 연출 — 새 결과가 뜨는 순간 3.2초 + 진동, 이후 기존 인라인 카드로
  const [winBlast, setWinBlast] = useState(null);
  const lastResultRef = useRef(null);
  useEffect(() => {
    const key = gameResult?.at || gameResult?.timestamp || (gameResult ? JSON.stringify(gameResult.winners || []) : null);
    if (!key || key === lastResultRef.current) return;
    if (isWinner && gameResult?.mode === currentMode && showsWinner) {
      lastResultRef.current = key;
      setWinBlast(currentMode);
      if ('vibrate' in navigator) navigator.vibrate([90, 40, 90, 40, 180]);
      const t = setTimeout(() => setWinBlast(null), 3200);
      return () => clearTimeout(t);
    }
  }, [gameResult, isWinner, currentMode, showsWinner]);

  return <MotionConfig reducedMotion="user"><div className="min-h-dvh bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center px-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-[calc(5rem+env(safe-area-inset-top))]">
    <StudentHeader sessionId={sessionId} />

    <AnimatePresence>
      {winBlast && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-sm">
        <Suspense fallback={null}><ConfettiBurst /></Suspense>
        <motion.div initial={{ scale: 0.4, rotate: -12 }} animate={{ scale: [0.4, 1.25, 1], rotate: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 18 }} className="flex items-center justify-center text-amber-400">
          {winBlast === 'randomPicker' ? <Mic size={96} strokeWidth={1.75} /> : <Trophy size={96} strokeWidth={1.75} />}
        </motion.div>
        <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mt-6 text-4xl font-black tracking-tight text-white">{winBlast === 'randomPicker' ? '발표 차례예요!' : '당첨!'}</motion.p>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className="mt-2 text-base font-medium text-amber-200">{winBlast === 'randomPicker' ? `${nickname}님, 앞으로 나와주세요!` : `${nickname}님, 축하합니다!`}</motion.p>
      </motion.div>}
    </AnimatePresence>

    {/* 상시 과제 — 대기 화면에도 노출되어 학생이 언제든 제출 가능 */}
    {persistentAssignmentId && <div className="w-full max-w-xl mb-6"><PersistentAssignmentCard sessionId={sessionId} questionId={persistentAssignmentId} questionTitle={persistentAssignmentTitle} /></div>}

    <AnimatePresence mode="wait">
      {showGameResult ? <motion.div key="game-result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={SPRING} className="text-center w-full max-w-sm space-y-6">
        <Suspense fallback={null}><ConfettiBurst /></Suspense>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 22, delay: 0.1 }} className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-slate-900 dark:bg-slate-100 flex items-center justify-center">
            <motion.div animate={{ rotate: [0, -12, 12, -6, 6, 0] }} transition={{ duration: 0.5, delay: 0.3, ease: 'easeInOut' }}>
              {isPickerResult ? <Mic size={36} className="text-white dark:text-slate-900" /> : <Trophy size={36} className="text-white dark:text-slate-900" />}
            </motion.div>
          </div>
        </motion.div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">{isPickerResult ? (isWinner ? '발표 차례예요!' : '발표자 발표') : (isWinner ? '축하합니다!' : '당첨자 발표')}</h2>
          {isWinner && <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-slate-500 dark:text-slate-400 text-sm">{isPickerResult ? '앞으로 나와 마이크를 잡아주세요' : '추첨에서 당첨되었어요!'}</motion.p>}
        </div>
        <div className="flex flex-col items-center gap-3">
          {winnerNames.map((name, i) => {
            const isMeWinner = name === nickname;
            return <motion.div key={name + i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.1, type: 'spring', stiffness: 400, damping: 22 }}
              className={`flex items-center gap-3 rounded-2xl py-3 px-5 ${isMeWinner ? 'bg-slate-900 dark:bg-slate-100' : 'bg-white dark:bg-slate-800 shadow-sm ring-1 ring-slate-200/70 dark:ring-slate-700/60'}`}>
              <Avatar name={name} size="md" />
              <span className={`text-lg font-bold tracking-tight ${isMeWinner ? 'text-white dark:text-slate-900' : 'text-slate-900 dark:text-slate-100'}`}>{name}</span>
              {isMeWinner && <span className="text-xs font-bold bg-white/20 dark:bg-slate-900/20 px-2 py-0.5 rounded-full text-white/90 dark:text-slate-900/80">나!</span>}
            </motion.div>;
          })}
        </div>
        {!isWinner && winnerNames.length > 0 && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-slate-600 dark:text-slate-400 text-sm">{isPickerResult ? '큰 박수로 응원해주세요!' : '다음 기회에 도전해보세요'}</motion.p>}
      </motion.div>
      : <motion.div key="waiting" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }} className="text-center w-full max-w-sm flex flex-col items-center gap-6">
        <div className="flex justify-center scale-[0.85] sm:scale-100 origin-bottom"><IdleMascot /></div>
        <div className="space-y-1.5">
          {nickname && <h1 className="break-keep [overflow-wrap:anywhere] text-slate-900 dark:text-slate-100 text-xl font-bold tracking-tight leading-tight">{nickname}님, 준비됐어요!</h1>}
          {courseName && <p className="break-keep [overflow-wrap:anywhere] text-slate-500 dark:text-slate-400 text-[15px] font-medium">{courseName}</p>}
        </div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.12 }}><WaitingStatusLine sessionId={sessionId} currentMode={currentMode} pendingEvent={pendingEvent} /></motion.div>
        {pendingEvent && <div className="w-full"><QuizEventBanner event={pendingEvent} state="pending" /></div>}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.2 }} className="w-full"><WaitingLive sessionId={sessionId} /></motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.3 }} className="flex items-center justify-center"><CopyableCode key={sessionId} code={sessionId} /></motion.div>
      </motion.div>}
    </AnimatePresence>

    <ReviewingBanner sessionId={sessionId} />
    <StudentBottomBar sessionId={sessionId} />
  </div></MotionConfig>;
});
