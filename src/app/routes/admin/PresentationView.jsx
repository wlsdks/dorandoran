import { useAIAvailability } from '@/hooks/useAIAvailability';
import ParticipationSpotlight from '@/components/ui/ParticipationSpotlight';
import { useState, useCallback, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import DrumrollOverlay from '@/components/ui/DrumrollOverlay';
import { isQuizQuestion, normalizeQuizEvent } from '@/lib/quiz';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, QrCode, X, Copy, Check, Hand, MessageSquare, ChevronDown, ChevronLeft, ChevronRight, Eye, Trophy, Maximize, Minimize } from 'lucide-react';
import { ref, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import Button from '@/components/ui/Button';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import QRCode from '@/components/ui/QRCode';
import VizRenderer from '@/features/visualization/components/VizRenderer';
import JoinToast from '@/features/participants/components/JoinToast';
import HandRaiseList from '@/features/hand-raise/components/HandRaiseList';
import UrgentQuestionList from '@/features/questions/components/UrgentQuestionList';
import ReactionOverlay from '@/features/reactions/components/ReactionOverlay';
import ChatBubbleOverlay from '@/features/reactions/components/ChatBubbleOverlay';
import { useGameResultPublisher } from '@/features/games/api/useGameResult';
import Leaderboard from '@/features/quiz/components/Leaderboard';
import PersistentAssignmentBar from '@/features/ai-judge/components/PersistentAssignmentBar';
import { useQuestionActions, trimEphemeralFeeds } from '@/hooks/useQuestionActions';
import { useTimer } from '@/features/timer/api/useTimer';
import { PresentEmptyState, PresentQROverlay, GameFallback, SideNoticesPanel, ExitHint, PresentModeMenu, PresentTimerButton } from './PresentationParts';
import { usePresentationScreen } from '@/hooks/usePresentationScreen';

const Lottery = lazy(() => import('@/features/games/components/Lottery'));
const ScratchCard = lazy(() => import('@/features/games/components/ScratchCard'));
const BreakTimer = lazy(() => import('@/features/games/components/BreakTimer'));
const ClassQABoard = lazy(() => import('@/features/class-questions/components/ClassQABoard'));
const AwardsCeremony = lazy(() => import('@/features/assignments/components/AwardsCeremony'));
const RandomPicker = lazy(() => import('@/features/games/components/RandomPicker'));
const ComprehensionPresenter = lazy(() => import('@/features/session/components/ComprehensionCheck').then(m => ({ default: m.ComprehensionPresenter })));
const SurveyPresenter = lazy(() => import('@/features/session/components/QuickSurvey').then(m => ({ default: m.SurveyPresenter })));
const DiscussionPresenter = lazy(() => import('@/features/session/components/DiscussionPresenter'));
const CombinedRanking = lazy(() => import('@/features/quiz/components/CombinedRanking'));
const QARanking = lazy(() => import('@/features/class-questions/components/QARanking'));
const JoinShow = lazy(() => import('@/features/games/components/JoinShow'));

// Mode-specific transition variants (MainContent 전용 로컬 헬퍼)
function getModeVariants(mode) {
  if (mode === 'leaderboard') {
    return { initial: { opacity: 0, y: -12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 12 } };
  }
  if (['lottery', 'scratchCard', 'breakTime', 'awards', 'randomPicker', 'comprehension', 'quickSurvey', 'discussion', 'focus', 'combinedRanking', 'qaRanking', 'joinShow'].includes(mode)) {
    return { initial: { opacity: 0, scale: 0.98 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.98 } };
  }
  if (['poll', 'quiz'].includes(mode)) {
    return { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -12 } };
  }
  return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
}

function MainContent({ currentMode, sessionId, session, onlineList, leaderboard, drawParticipants, presentMode, studentUrl, count, onGameResult }) {
  const currentQId = session?.currentQuestion;
  const isActive = ['poll', 'quiz'].includes(currentMode) && currentQId;

  // Determine content + animation key
  let contentKey, content;
  const gameContent = (() => {
    if (currentMode === 'lottery') return (
      <Lottery
        participants={drawParticipants}
        onResult={(names) => onGameResult?.(names, 'lottery')}
        presenter={presentMode}
        sessionId={sessionId}
        role="control"
      />
    );
    if (currentMode === 'scratchCard') return (
      <ScratchCard
        participants={drawParticipants}
        onResult={(w) => onGameResult?.(w, 'scratchCard')}
        presenter={presentMode}
        sessionId={sessionId}
        role="control"
      />
    );
    if (currentMode === 'breakTime') return <BreakTimer sessionId={sessionId} presenter={presentMode} />;
    if (currentMode === 'leaderboard') return <div className="w-full max-w-xl md:max-w-2xl [&_.max-w-xl]:max-w-2xl px-2 md:px-0" style={{ maxWidth: presentMode ? 1100 : undefined }}><Leaderboard presenter={presentMode} entries={leaderboard} maxShow={10} title="실시간 리더보드" emptyLabel="아직 점수가 없습니다" /></div>;
    if (currentMode === 'qaBoard') return <div className="w-full max-w-4xl" style={{ maxWidth: presentMode ? 1100 : undefined }}><ClassQABoard presenter={presentMode} readOnly={presentMode} sessionId={sessionId} showInput={false} isAdmin role="admin" /></div>;
    if (currentMode === 'qaRanking') return <QARanking sessionId={sessionId} presenter={presentMode} readOnly={presentMode} />;
    if (currentMode === 'joinShow') return <JoinShow sessionId={sessionId} />;
    if (currentMode === 'awards') return <AwardsCeremony sessionId={sessionId} assignmentId={session?.activeAssignmentId} />;
    if (currentMode === 'randomPicker') return (
      <RandomPicker presenter={presentMode} participants={onlineList} onResult={(w) => onGameResult?.(w, 'randomPicker')} sessionId={sessionId} role="control" />
    );
    if (currentMode === 'comprehension') return <ComprehensionPresenter sessionId={sessionId} presenter={presentMode} />;
    if (currentMode === 'quickSurvey') return <SurveyPresenter sessionId={sessionId} presenter={presentMode} />;
    if (currentMode === 'discussion') return <DiscussionPresenter sessionId={sessionId} presenter={presentMode} />;
    if (currentMode === 'combinedRanking') return <CombinedRanking session={session} />;
    if (currentMode === 'focus') return (
      <div className="flex flex-col items-center justify-center gap-4 md:gap-6 text-center">
        <DoranDoranMascot size="lg" mood="focus" />
        <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">집중 모드</p>
        <p className="text-slate-400 dark:text-white/40 text-sm md:text-lg">학생 화면이 잠겼습니다</p>
      </div>
    );
    return null;
  })();

  if (gameContent) {
    contentKey = `game-${currentMode}`;
    content = <Suspense fallback={<GameFallback />}>{gameContent}</Suspense>;
  } else if (isActive) {
    contentKey = `question-${currentQId}`;
    content = <div className="w-full px-2 md:px-0 [&_.max-w-xl]:max-w-3xl [&_.max-w-md]:max-w-xl"><VizRenderer sessionId={sessionId} session={session} isAdmin isPresenter={presentMode} /></div>;
  } else if (presentMode) {
    contentKey = 'empty';
    content = <PresentEmptyState sessionId={sessionId} studentUrl={studentUrl} count={count} />;
  } else {
    contentKey = 'viz-empty';
    content = <VizRenderer sessionId={sessionId} session={session} isAdmin />;
  }

  const variants = getModeVariants(gameContent ? currentMode : isActive ? currentMode : 'waiting');

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={contentKey}
        {...variants}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={`flex-1 flex justify-center w-full ${contentKey === 'game-qaBoard' ? 'items-start overflow-y-auto' : 'items-center'}`}
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
}

export { MainContent };


export function PresentRevealControls({ sessionId, session, onRevealQuiz, onRevealAnswer }) {
  const [drumroll, setDrumroll] = useState(false);
  const [pendingReveal, setPendingReveal] = useState(null);
  const [revealError, setRevealError] = useState(null);
  const revealLock = useRef(null);
  const currentQId = session?.currentQuestion;
  const question = currentQId ? session?.questions?.[currentQId] : null;
  const revealScope = `${sessionId}:${currentQId}`;
  const isApplying = pendingReveal === revealScope;
  useEffect(() => {
    revealLock.current = null;
    return () => { revealLock.current = null; };
  }, [revealScope]);
  if (!question) return null;

  // 퀴즈도 발표 모드에서 두구두구/정답 공개 가능. 단, 퀴즈는 점수 반영(revealQuiz)이 필요해
  // useQuestionActions의 함수를 통해 처리 — 일반 정답형/MH는 단순 revealedAt만 찍음(revealAnswer).
  const isQuiz = isQuizQuestion(question);
  const hasAnswer = isQuiz || question.correctAnswer || question.type === 'ranking';
  const isMH = ['mysteryBox', 'hintQuiz'].includes(question.type);
  if (!hasAnswer && !isMH) return null;

  // 정답 공개 후: 당첨자 공개 버튼 (mysteryBox/hintQuiz만)
  const presetWinners = question.winners || [];
  const revealedWinners = question.revealedWinners || 0;
  const canRevealWinner = question.revealedAt && isMH && presetWinners.length > 0 && revealedWinners < presetWinners.length;

  if (isQuiz && question.revealedAt && !question.awardedAt) return <div className="flex items-center justify-center gap-3 flex-wrap">
    <p role="status" className="text-base text-slate-600 dark:text-slate-300">{isApplying ? '점수를 반영하고 있어요' : '점수 반영이 아직 완료되지 않았어요'}</p>
    <Button onClick={handleRevealAnswer} disabled={isApplying} variant="secondary" aria-label="퀴즈 점수 반영 다시 시도">{isApplying ? '반영 중...' : '점수 반영 다시 시도'}</Button>
    {revealError?.scope === revealScope && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{revealError.message}</p>}
  </div>;
  if (question.revealedAt && !canRevealWinner) return null;
  if (question.revealedAt && canRevealWinner) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={async () => {
          await update(ref(db, `sessions/${sessionId}`), {
            [`questions/${currentQId}/revealedWinners`]: revealedWinners + 1,
          });
        }} variant="primary" size="lg">
          <Trophy size={20} />
          {revealedWinners + 1}등 당첨자 공개 ({revealedWinners}/{presetWinners.length})
        </Button>
      </div>
    );
  }

  const isHint = question.type === 'hintQuiz';
  const hints = question.hints || [];
  const revealedHints = question.revealedHints || 0;
  const canRevealHint = isHint && revealedHints < hints.length;

  async function handleRevealHint() {
    if (!canRevealHint) return;
    await update(ref(db, `sessions/${sessionId}`), {
      [`questions/${currentQId}/revealedHints`]: revealedHints + 1,
    });
  }

  async function handleRevealAnswer() {
    if (revealLock.current) return;
    const token = { scope: revealScope };
    revealLock.current = token;
    setPendingReveal(revealScope);
    setRevealError(null);
    try {
      const saved = isQuiz ? await onRevealQuiz?.(currentQId) : await onRevealAnswer?.(currentQId);
      if (saved === false && revealLock.current === token) setRevealError({ scope: revealScope, message: '반영하지 못했어요. 다시 시도해주세요.' });
    } catch {
      if (revealLock.current === token) setRevealError({ scope: revealScope, message: '반영하지 못했어요. 다시 시도해주세요.' });
    } finally {
      if (revealLock.current === token) await update(ref(db, `sessions/${sessionId}`), { drumroll: null }).catch(() => {});
      if (revealLock.current === token) {
        revealLock.current = null;
        setPendingReveal(null);
      }
    }
  }

  return (
    <>
      <DrumrollOverlay active={drumroll} onComplete={() => { setDrumroll(false); handleRevealAnswer(); }} />

      <div className="flex items-center justify-center gap-2 flex-wrap">
        {canRevealHint && (
          <Button onClick={handleRevealHint} variant="secondary" size="lg">
            <ChevronRight size={20} />
            힌트 공개 ({revealedHints}/{hints.length})
          </Button>
        )}
        <Button onClick={async () => {
          setDrumroll(true);
          try { await update(ref(db, `sessions/${sessionId}`), { drumroll: true }); } catch { setDrumroll(false); }
        }} variant="ghost" size="lg">
          두구두구
        </Button>
        <Button onClick={handleRevealAnswer} disabled={isApplying} variant="primary" size="lg">
          <Eye size={20} />
          정답 공개
        </Button>
        {revealError?.scope === revealScope && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{revealError.message}</p>}
      </div>
    </>
  );
}



export default function PresentationView({ sessionId, session, currentMode, onlineList, leaderboard, drawParticipants, studentUrl, count, onExit, scores, participants }) {

  const { available: aiAvailable } = useAIAvailability();
  // 발표 모드에 있는 동안만 전체화면 + 화면 꺼짐 방지
  const { isFullscreen, toggleFullscreen, fullscreenSupported, exitFullscreen } = usePresentationScreen();
  const exitPresent = useCallback(() => { exitFullscreen(); onExit(); }, [exitFullscreen, onExit]);

  // 발표 모드에서도 퀴즈/정답형 정답 공개를 트리거할 수 있도록 reveal 함수를 가져옴.
  // QuestionManager는 이 모드에서 마운트되지 않으므로 PresentationView가 직접 hook 호출.
  const { revealQuiz, revealAnswer } = useQuestionActions(sessionId, session?.questions || {}, session?.currentQuestion, scores, participants);

  // 게임 결과 발행 — winner-mapping 로직은 공유 훅에 일원화(4개 라우트 복제 제거)
  const { handleGameResult } = useGameResultPublisher(sessionId, onlineList, drawParticipants);

  // 발표모드에서도 타이머 제어 — 헤더로 나가지 않고 preset(15/30/60초)로 바로 시작/중지.
  const { isRunning: timerRunning, startTimer, stopTimer } = useTimer(sessionId);
  const activeQuestion = ['poll', 'quiz'].includes(currentMode) && session?.currentQuestion;

  // 질문 네비게이션
  const questionList = useMemo(() => {
    return Object.entries(session?.questions || {}).sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
  }, [session?.questions]);
  const currentQIdx = questionList.findIndex(([id]) => id === session?.currentQuestion);

  const goToQuestion = useCallback(async (qId, nextEvent = null) => {
    const q = session?.questions?.[qId];
    if (!q) return;
    const mode = isQuizQuestion(q) ? 'quiz' : 'poll';
    if (isQuizQuestion(q) && (q.revealedAt || q.awardedAt)) {
      await update(ref(db, `sessions/${sessionId}`), { currentQuestion: qId, currentMode: mode, speedQuiz: null, drumroll: null, timer: null });
      return;
    }
    const updates = {
      currentQuestion: qId, currentMode: mode,
      [`questions/${qId}/activatedAt`]: Date.now(),
      [`questions/${qId}/revealedAt`]: null,
      speedQuiz: null,
      drumroll: null,
      timer: null, // 이전 질문 타이머 잔존 → 다음 질문 학생 잠금 전파 방지
    };
    if (q.type === 'imageSlide' && !Number.isInteger(q.currentSlide)) updates[`questions/${qId}/currentSlide`] = 0;
    if (q.type === 'hintQuiz') updates[`questions/${qId}/revealedHints`] = 0;
    if (['mysteryBox', 'hintQuiz'].includes(q.type)) updates[`questions/${qId}/revealedWinners`] = 0;
    // 발표모드에서도 점수 이벤트 적용 — 대시보드 빠른진행과 동일 경로
    if (nextEvent && isQuizQuestion(q)) {
      updates[`questions/${qId}/event`] = normalizeQuizEvent(nextEvent);
      updates.pendingEvent = null; // 새 퀴즈에 적용할 때 한 번만 소진
    }
    await update(ref(db, `sessions/${sessionId}`), updates);
    trimEphemeralFeeds(sessionId); // 리액션·한마디 최근 50 유지(비동기, 실패 무해)
  }, [sessionId, session?.questions]);

  const goPrev = useCallback(() => {
    if (currentQIdx > 0) goToQuestion(questionList[currentQIdx - 1][0]);
  }, [currentQIdx, questionList, goToQuestion]);

  const goNext = useCallback(() => {
    if (currentQIdx < questionList.length - 1) {
      goToQuestion(questionList[currentQIdx + 1][0], session?.pendingEvent);
    }
  }, [currentQIdx, questionList, goToQuestion, session?.pendingEvent]);

  const [slideBookmark, setSlideBookmark] = useState(null);
  const current = session?.questions?.[session?.currentQuestion];
  useEffect(() => {
    if (current?.type === 'imageSlide') setSlideBookmark({ sessionId, questionId: session.currentQuestion, slide: current.currentSlide || 0 });
  }, [sessionId, session?.currentQuestion, current?.type, current?.currentSlide]);
  const returnToSlides = useCallback(() => {
    if (slideBookmark?.sessionId !== sessionId) return;
    update(ref(db, `sessions/${sessionId}`), { currentQuestion: slideBookmark.questionId, currentMode: 'poll', timer: null, speedQuiz: null,
      [`questions/${slideBookmark.questionId}/currentSlide`]: slideBookmark.slide }).catch(() => {});
  }, [sessionId, slideBookmark]);
  useEffect(() => {
    const handler = (event) => {
      if (event.defaultPrevented || event.target?.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]')) return;
      if (event.key === 'Escape') { exitPresent(); return; }
      if (event.key === ' ' && event.target?.closest('button,a[href]')) return;
      const question = session?.questions?.[session?.currentQuestion];
      const slide = Number.isInteger(question?.currentSlide) ? question.currentSlide : 0;
      const images = question?.slideImages || [];
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (question?.type === 'imageSlide' && slide > 0) update(ref(db, `sessions/${sessionId}/questions/${session.currentQuestion}`), { currentSlide: slide - 1 }).catch(() => {});
        else goPrev();
      }
      if (event.key === 'ArrowRight' || event.code === 'Space') {
        event.preventDefault();
        if (question?.type === 'imageSlide' && slide < images.length - 1) update(ref(db, `sessions/${sessionId}/questions/${session.currentQuestion}`), { currentSlide: slide + 1 }).catch(() => {});
        else goNext();
      }
      if (event.key.toLowerCase() === 'f') toggleFullscreen();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sessionId, session?.questions, session?.currentQuestion, exitPresent, goPrev, goNext, toggleFullscreen]);

  return (
    <div className="dark classroom-stage presenter-stage h-dvh bg-slate-900 relative overflow-hidden">
      <ParticipationSpotlight sessionId={sessionId} />
      <JoinToast sessionId={sessionId} />
      <ReactionOverlay sessionId={sessionId} />
      <ChatBubbleOverlay sessionId={sessionId} />


      <SideNoticesPanel sessionId={sessionId} />

      {/* 우상단 클러스터 — 타이머 버튼(활성 질문일 때) + 나가기, 나란히 정렬 */}
      <div className="fixed top-4 right-4 md:top-6 md:right-6 z-30 flex items-center gap-2">
        {activeQuestion && (
          <PresentTimerButton isRunning={timerRunning} onStart={startTimer} onStop={stopTimer} />
        )}
        {fullscreenSupported && (
          <button
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? '전체화면 해제' : '전체화면'}
            title={isFullscreen ? '전체화면 해제' : '전체화면'}
            className="presentation-button"
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}<span className="hidden lg:inline">{isFullscreen ? '전체화면 해제' : '전체화면'}</span>
          </button>
        )}
        <ExitHint onExit={exitPresent} />
      </div>

      {/* 상시 과제 바 — 발표 모드에서도 강사가 제출 상태/심사 상태 확인 가능.
          단, 상시 과제 자체가 현재 활성 질문일 때는 메인 뷰에 이미 노출되므로 중복 방지 (학생 VoteModeContent와 동일 규칙). */}
      {aiAvailable && session?.persistentAssignmentId && session?.currentQuestion !== session?.persistentAssignmentId && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-20 w-[min(42rem,calc(100vw-6rem))] pointer-events-auto">
          <PersistentAssignmentBar
            sessionId={sessionId}
            session={session}
            onActivateQuestion={(qId) => {
              const q = session?.questions?.[qId];
              if (!q) return;
              const mode = isQuizQuestion(q) ? 'quiz' : 'poll';
              update(ref(db, `sessions/${sessionId}`), {
                currentQuestion: qId, currentMode: mode,
                [`questions/${qId}/activatedAt`]: Date.now(),
              }).catch(() => {});
            }}
          />
        </div>
      )}

      {/* Main content — responsive padding */}
      <div className="presentation-canvas flex items-center justify-center h-full px-4 sm:px-8 text-lg overflow-y-auto">
        <MainContent
          currentMode={currentMode}
          sessionId={sessionId}
          session={session}
          onlineList={onlineList}
          leaderboard={leaderboard}
          drawParticipants={drawParticipants}
          presentMode
          studentUrl={studentUrl}
          count={count}
          scores={scores}
          onGameResult={handleGameResult}
        />
      </div>

      <footer className="presentation-footer" aria-label="발표 진행 도구">
        <div className="flex items-center gap-3 shrink-0">
          <span className="inline-flex items-center gap-2 text-slate-200 text-sm"><span className="w-2 h-2 bg-emerald-400 rounded-full" /><Users size={18} />{count}명</span>
          <span className="text-slate-400 text-sm tabular-nums">{Math.max(currentQIdx + 1, 0)} / {questionList.length} 문항</span>
        </div>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {current?.type === 'imageSlide' ? <>
            <Button variant="secondary" size="lg" disabled={(current.currentSlide || 0) <= 0} onClick={() => update(ref(db, `sessions/${sessionId}/questions/${session.currentQuestion}`), { currentSlide: Math.max(0, (current.currentSlide || 0) - 1) }).catch(() => {})}><ChevronLeft size={20} />이전</Button>
            <span className="px-2 text-slate-200 font-semibold tabular-nums">{(current.currentSlide || 0) + 1} / {current.slideImages?.length || 1}</span>
            <Button variant="primary" size="lg" disabled={(current.currentSlide || 0) >= (current.slideImages?.length || 1) - 1 && currentQIdx >= questionList.length - 1}
              onClick={() => (current.currentSlide || 0) >= current.slideImages.length - 1 ? goNext() : update(ref(db, `sessions/${sessionId}/questions/${session.currentQuestion}`), { currentSlide: (current.currentSlide || 0) + 1 }).catch(() => {})}>
              {(current.currentSlide || 0) >= (current.slideImages?.length || 1) - 1 ? '다음 활동' : '다음'}<ChevronRight size={20} /></Button>
          </> : <>
            <Button variant="secondary" size="lg" onClick={goPrev} disabled={currentQIdx <= 0}><ChevronLeft size={18} />이전</Button>
            <PresentRevealControls key={session?.currentQuestion} sessionId={sessionId} session={session} onRevealQuiz={revealQuiz} onRevealAnswer={revealAnswer} />
            <Button variant="secondary" size="lg" onClick={goNext} disabled={currentQIdx >= questionList.length - 1}>다음 활동<ChevronRight size={18} /></Button>
          </>}
        </div>
        <div className="flex items-center justify-end gap-2 flex-wrap">
          {current?.type !== 'imageSlide' && slideBookmark?.sessionId === sessionId && <Button variant="secondary" size="lg" onClick={returnToSlides}><ChevronLeft size={18} />슬라이드로 돌아가기</Button>}
          <PresentQROverlay sessionId={sessionId} studentUrl={studentUrl} count={count} />
        </div>
      </footer>

      {/* 좌측 상단 — 모드 전환 (알림 토글 옆) */}
      <PresentModeMenu sessionId={sessionId} currentMode={currentMode} currentQuestion={session?.currentQuestion} hasLeaderboard={leaderboard.length > 0} />
    </div>
  );
}
