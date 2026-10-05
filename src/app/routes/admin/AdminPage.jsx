import { lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAdminSession } from '@/hooks/useAdminSession';
import AdminLogin from './AdminLogin';
import SessionDashboard from './SessionDashboard';
import QuestionManager from './QuestionManager';
import JoinToast from '@/features/participants/components/JoinToast';
import { PanelLeftOpen } from 'lucide-react';
import { SuspenseFallback } from '@/components/ui/Skeleton';
import ReactionOverlay from '@/features/reactions/components/ReactionOverlay';
import AnswerBubbleOverlay from '@/features/voting/components/AnswerBubbleOverlay';
import ChatBubbleOverlay from '@/features/reactions/components/ChatBubbleOverlay';
import ChatPanel from '@/features/chat/components/ChatPanel';
import { useGameResultPublisher } from '@/features/games/api/useGameResult';
import AdminSessionHeader from './AdminSessionHeader';
import RightSidebar from './RightSidebar';
import { isSpecialMode as isSpecialModeKey } from '@/lib/modes';
import PresentationView, { PresentRevealControls } from './PresentationView';
import ModeSwitcher from './ModeSwitcher';
import TabletDrawers from './TabletDrawers';
import CenterContent from './CenterContent';
import MobileAdminView from './MobileAdminView';
const StaffPage = lazy(() => import('./StaffPage'));
const StaffCourseDashboard = lazy(() => import('./StaffCourseDashboard'));
export default function AdminPage() {
  const s = useAdminSession();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTablet = useMediaQuery('(max-width: 1199px)');

  // P0-1: 게임 결과 발행을 강사 일반 모드에서도 보장 (전자칠판 의존성 제거)
  // 모든 early-return 전에 호출되어야 함 (Rules of Hooks)
  // 게임 결과 발행 — winner-mapping 로직은 공유 훅에 일원화(4개 라우트 복제 제거)
  const {
    handleGameResult
  } = useGameResultPublisher(s.sessionId, s.onlineList, s.drawParticipants);
  if (!s.adminUser) return <AdminLogin onLogin={s.handleLogin} />;
  if (!s.sessionId) {
    if (s.adminUser?.role === 'staff') {
      return <Suspense fallback={<SuspenseFallback />}>
          <StaffCourseDashboard adminUser={s.adminUser} onSelectSession={s.handleSelectSession} onLogout={s.handleLogout} />
        </Suspense>;
    }
    return <SessionDashboard onSelectSession={s.handleSelectSession} onLogout={s.handleLogout} adminUser={s.adminUser} isMaster={s.isMaster} pendingAdmins={s.pendingAdmins} pendingCount={s.pendingCount} approveAdmin={s.approveAdmin} rejectAdmin={s.rejectAdmin} />;
  }
  if (s.loading) return <SuspenseFallback />;
  if (!s.session) {
    s.handleBack();
    return null;
  }
  if (s.adminUser?.role === 'staff') {
    return <Suspense fallback={<SuspenseFallback />}>
        <StaffPage sessionId={s.sessionId} session={s.session} adminUser={s.adminUser} onBack={s.handleBack} onLogout={s.handleLogout} />
      </Suspense>;
  }

  // Mobile: bottom tab layout (phone-sized screens)
  if (isMobile && !s.presentMode) {
    return <MobileAdminView s={s} />;
  }
  const currentMode = s.session?.currentMode;
  const isSpecialMode = isSpecialModeKey(currentMode);
  if (s.presentMode) {
    return <PresentationView sessionId={s.sessionId} session={s.session} currentMode={currentMode} onlineList={s.onlineList} leaderboard={s.leaderboard} drawParticipants={s.drawParticipants} studentUrl={s.studentUrl} count={s.count} onExit={s.handleExitPresent} readOnly={s.effectiveReadOnly} scores={s.scores} participants={s.participants} />;
  }
  const leftSidebarContent = <>
      <QuestionManager onCollapse={isTablet ? undefined : s.effectiveReadOnly ? undefined : s.handleCollapseClose} sessionId={s.sessionId} questions={s.session?.questions || {}} currentQuestion={s.session?.currentQuestion} scores={s.scores} participants={s.participants} pendingEvent={s.session?.pendingEvent || null} readOnly={s.effectiveReadOnly} formOpen={s.showCenterForm} onAddClick={s.effectiveReadOnly ? undefined : s.handleShowCenterForm} onEditClick={s.effectiveReadOnly ? undefined : s.handleEditQuestion} onViewQuestion={s.handleViewQuestion} adminUid={s.adminUser?.uid} speedQuizActive={s.speedQuizActive} onStartSpeedQuiz={s.startSpeedQuiz} onEndSpeedQuiz={s.endSpeedQuiz} speedQuizCount={s.speedQuizCount} modeButton={!s.effectiveReadOnly ? <ModeSwitcher currentMode={currentMode} isSpecialMode={isSpecialMode} onAddModeCard={s.addModeCard} leaderboard={s.leaderboard} modeOpen={s.modeOpen} onToggle={s.handleModeToggle} onSwitchMode={s.switchMode} /> : null} />
    </>;
  return <div className="h-dvh bg-slate-50 dark:bg-slate-900 flex flex-col overflow-hidden">
      <JoinToast sessionId={s.sessionId} />
      <ReactionOverlay sessionId={s.sessionId} />
      <AnswerBubbleOverlay sessionId={s.sessionId} questionId={s.session?.currentQuestion} />
      <ChatBubbleOverlay sessionId={s.sessionId} />
      <AnimatePresence>
        {s.actionError && <motion.div initial={{
        opacity: 0,
        y: -20
      }} animate={{
        opacity: 1,
        y: 0
      }} exit={{
        opacity: 0,
        y: -20
      }} className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2">
            <AlertCircle size={16} />{s.actionError}
          </motion.div>}
      </AnimatePresence>
      <ChatPanel sessionId={s.sessionId} senderName={s.adminUser?.displayName || '강사'} senderType="instructor" open={s.chatOpen} onClose={s.handleChatClose} onNewMessage={s.handleNewChatMessage} />

      <AdminSessionHeader session={s.session} sessionId={s.sessionId} effectiveReadOnly={s.effectiveReadOnly} isSetting={s.isSetting} questionProgress={s.questionProgress} count={s.count} chatOpen={s.chatOpen} hasUnreadChat={s.hasUnreadChat} onChatToggle={s.handleChatToggle} timerRunning={s.timerRunning} endTime={s.endTime} duration={s.duration} onTimerStart={s.startTimer} onTimerStop={s.stopTimer} onTimerExpire={s.expireTimer} onBack={s.handleBack} onStartSession={s.handleStartSession} onEndSession={s.handleEndSession} onPresentMode={s.handlePresentMode} isTablet={isTablet} onLeftDrawer={s.handleLeftDrawerOpen} onRightDrawer={s.handleRightDrawerOpen} speedQuizActive={s.speedQuizActive} isReviewing={s.isReviewing} onFullEndSession={s.handleFullEndSession} courseId={s.session?.courseId} courseName={s.session?.courseName} />

      {isTablet && <TabletDrawers leftOpen={s.leftDrawerOpen} rightOpen={s.rightDrawerOpen} onCloseLeft={s.handleLeftDrawerClose} onCloseRight={s.handleRightDrawerClose} leftContent={leftSidebarContent} rightContent={<RightSidebar session={s.session} sessionId={s.sessionId} effectiveReadOnly={s.effectiveReadOnly} participants={s.participants} onlineList={s.onlineList} count={s.count} leaderboard={s.leaderboard} voteCounts={s.voteCounts} studentUrl={s.studentUrl} sidebarCollapsed={false} isDrawer courseId={s.session?.courseId} />} />}

      <div className="flex flex-1 overflow-hidden">
        {!isTablet && <AnimatePresence>
            {s.sidebarCollapsed && <motion.button initial={{
          opacity: 0,
          x: -8
        }} animate={{
          opacity: 1,
          x: 0
        }} exit={{
          opacity: 0,
          x: -8
        }} transition={{
          duration: 0.15
        }} onClick={s.handleCollapseOpen} className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 border-l-0 rounded-r-xl p-3 shadow-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors duration-150 active:scale-[0.96]" aria-label="사이드바 열기">
                <PanelLeftOpen size={22} />
              </motion.button>}
          </AnimatePresence>}

        {!isTablet && <motion.div animate={{
        width: s.sidebarCollapsed ? 0 : 'clamp(280px, 22vw, 320px)',
        minWidth: s.sidebarCollapsed ? 0 : 280
      }} transition={{
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1]
      }} className="border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shrink-0 min-w-0 max-w-[460px] h-full">
            <div className="min-w-[280px] p-6 overflow-y-auto h-full scrollbar-hide">{leftSidebarContent}</div>
          </motion.div>}

        <div className={`flex-1 min-w-0 overflow-auto relative h-full scrollbar-hide ${isTablet ? 'p-4' : 'p-8'}`}>
          <CenterContent showCenterForm={s.showCenterForm} onHideCenterForm={s.handleHideCenterForm} onCenterFormSubmit={s.handleCenterFormSubmit} editingQuestion={s.editingQuestion} effectiveReadOnly={s.effectiveReadOnly} session={s.session} currentMode={currentMode} sessionId={s.sessionId} onlineList={s.onlineList} leaderboard={s.leaderboard} drawParticipants={s.drawParticipants} participants={s.participants} scores={s.scores} count={s.count} onGameResult={handleGameResult} />
        </div>

        {!isTablet && <RightSidebar session={s.session} sessionId={s.sessionId} effectiveReadOnly={s.effectiveReadOnly} participants={s.participants} onlineList={s.onlineList} count={s.count} leaderboard={s.leaderboard} voteCounts={s.voteCounts} studentUrl={s.studentUrl} sidebarCollapsed={s.sidebarCollapsed} courseId={s.session?.courseId} />}
      </div>

      {/* P1-5: 두구두구 + 정답 공개 floating bar — 발표 모드 진입 안 해도 사용 가능 */}
      {!s.effectiveReadOnly && <PresentRevealControls sessionId={s.sessionId} session={s.session} onRevealQuiz={s.revealQuiz} onRevealAnswer={s.revealAnswer} />}
    </div>;
}
