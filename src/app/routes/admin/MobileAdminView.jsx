import { useState, useCallback } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { ArrowLeft, BarChart3, Users, MessageSquare, Play, MoreHorizontal, Gift, Coffee, Trophy, Gamepad2 } from 'lucide-react';
import JoinToast from '@/features/participants/components/JoinToast';
import ReactionOverlay from '@/features/reactions/components/ReactionOverlay';
import AnswerBubbleOverlay from '@/features/voting/components/AnswerBubbleOverlay';
import ChatBubbleOverlay from '@/features/reactions/components/ChatBubbleOverlay';
import { useGameResultPublisher } from '@/features/games/api/useGameResult';
import QuestionManager from './QuestionManager';
import CenterContent from './CenterContent';
import ChatPanel from '@/features/chat/components/ChatPanel';
import StaffDMAlert from '@/features/dm/components/StaffDMAlert';
import { getStaffSession } from '@/lib/auth-session';
import BottomSheet from '@/components/ui/BottomSheet';
import MobileModePicker from './MobileModePicker';
import MobileParticipantsTab from './MobileParticipantsTab';
import { isSpecialMode as isSpecialModeKey } from '@/lib/modes';
const TABS = [{
  key: 'progress',
  label: '진행',
  icon: Play
}, {
  key: 'results',
  label: '결과',
  icon: BarChart3
}, {
  key: 'participants',
  label: '참여',
  icon: Users
}, {
  key: 'chat',
  label: '채팅',
  icon: MessageSquare
}];

/* ─── Mode labels ─── */
const MODE_MAP = {
  lottery: {
    label: '추첨',
    icon: Gift
  },
  breakTime: {
    label: '쉬는시간',
    icon: Coffee
  },
  leaderboard: {
    label: '리더보드',
    icon: Trophy
  }
};

/* ─── Header ─── */
function MobileHeader({
  session,
  count,
  onBack,
  effectiveReadOnly,
  isSetting,
  onStartSession,
  activeTab,
  onBackToTab,
  onOpenSettings,
  isSpecialMode,
  currentMode,
  onOpenModes
}) {
  const courseName = session?.courseName || '도란도란';
  const round = session?.roundNumber ? `${session.roundNumber}차` : '';
  const isActive = session?.status === 'active' || session?.status === 'reviewing';
  const modeInfo = MODE_MAP[currentMode];
  return <div className="flex items-center justify-between px-5 py-3.5 bg-white dark:bg-slate-800 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={activeTab !== 'progress' ? onBackToTab : onBack} className="min-h-11 min-w-11 flex items-center justify-center p-2 -ml-2 shrink-0 rounded-xl text-slate-500 dark:text-slate-400 active:bg-slate-100 dark:active:bg-slate-700 transition-colors duration-150" aria-label="뒤로">
          <ArrowLeft size={22} />
        </button>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate tracking-tight">{courseName} {round}</h1>
          <div className="flex items-center gap-1.5 text-[13px] text-slate-500 dark:text-slate-400">
            {isActive && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
            <span><motion.span key={count} initial={{
              scale: 1.15
            }} animate={{
              scale: 1
            }} transition={{
              type: 'spring',
              stiffness: 400,
              damping: 22
            }} className="inline-block tabular-nums">{count}</motion.span>명 접속</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {isSetting && !effectiveReadOnly && <button onClick={onStartSession} className="min-h-11 px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold transition-colors duration-150 active:scale-[0.96]">
            수업 시작
          </button>}
        {/* Mode indicator — quick access to mode picker */}
        {!effectiveReadOnly && isActive && <motion.button whileTap={{
        scale: 0.92
      }} onClick={onOpenModes} className={`min-h-11 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors duration-150 ${isSpecialMode ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`} aria-label="모드 전환">
            {modeInfo ? <modeInfo.icon size={15} /> : <Gamepad2 size={15} />}
            <span className="max-w-[60px] truncate">{modeInfo?.label || '모드'}</span>
          </motion.button>}
        {!effectiveReadOnly && onOpenSettings && <motion.button whileTap={{
        scale: 0.9
      }} onClick={onOpenSettings} className="min-h-11 min-w-11 flex items-center justify-center p-2 rounded-xl text-slate-500 dark:text-slate-400 active:bg-slate-100 dark:active:bg-slate-700 transition-colors duration-150" aria-label="세션 설정">
            <MoreHorizontal size={20} />
          </motion.button>}
      </div>
    </div>;
}

/* ─── Bottom Tab Bar (Apple/토스 style: 56px + safe area) ─── */
function MobileTabBar({
  activeTab,
  onTabChange,
  hasUnreadChat
}) {
  return <LayoutGroup>
      <div className="flex bg-white dark:bg-slate-800 shrink-0" style={{
      paddingBottom: 'env(safe-area-inset-bottom)'
    }}>
        {TABS.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;
        return <motion.button key={tab.key} whileTap={{
          scale: 0.92
        }} onClick={() => onTabChange(tab.key)} className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-medium transition-colors duration-150 relative ${isActive ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
              {isActive && <motion.div layoutId="mobile-tab-indicator" className="absolute top-0 left-3 right-3 h-[2px] rounded-full bg-slate-900 dark:bg-slate-100" transition={{
            type: 'spring',
            stiffness: 500,
            damping: 30
          }} />}
              <Icon size={24} strokeWidth={isActive ? 2 : 1.5} />
              <span>{tab.label}</span>
              {tab.key === 'chat' && hasUnreadChat && <span className="absolute top-2 left-1/2 ml-2 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />}
            </motion.button>;
      })}
      </div>
    </LayoutGroup>;
}

/* ─── Main Mobile View ─── */
export default function MobileAdminView({
  s
}) {
  const [activeTab, setActiveTab] = useState('progress');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modesOpen, setModesOpen] = useState(false);
  const currentMode = s.session?.currentMode;
  const isSpecialMode = isSpecialModeKey(currentMode);
  const onNewChatMsg = s.handleNewChatMessage;
  const handleNewChatMessage = useCallback(() => {
    if (activeTab !== 'chat') onNewChatMsg();
  }, [activeTab, onNewChatMsg]);

  // P0-1: 모바일 강사 화면에서도 게임 결과 발행
  // 게임 결과 발행 — winner-mapping 로직은 공유 훅에 일원화(4개 라우트 복제 제거)
  const {
    handleGameResult
  } = useGameResultPublisher(s.sessionId, s.onlineList, s.drawParticipants);
  return <div className="h-dvh bg-slate-50 dark:bg-slate-900 flex flex-col overflow-hidden">
      <JoinToast sessionId={s.sessionId} />
      {/* 학생 1:1 도움 요청 — 모바일에서는 화면 위에 알림으로 띄운다 */}
      {!s.effectiveReadOnly && <StaffDMAlert sessionId={s.sessionId} staffId={getStaffSession()?.uid} staffName={getStaffSession()?.displayName || '강사'} senderType="instructor" />}
      <ReactionOverlay sessionId={s.sessionId} />
      <AnswerBubbleOverlay sessionId={s.sessionId} questionId={s.session?.currentQuestion} />
      <ChatBubbleOverlay sessionId={s.sessionId} />

      <MobileHeader session={s.session} count={s.count} onBack={s.handleBack} onStartSession={s.handleStartSession} effectiveReadOnly={s.effectiveReadOnly} isSetting={s.isSetting} activeTab={activeTab} onBackToTab={() => setActiveTab('progress')} onOpenSettings={() => setSettingsOpen(true)} isSpecialMode={isSpecialMode} currentMode={currentMode} onOpenModes={() => setModesOpen(true)} />

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'progress' && <motion.div key="progress" initial={{
          opacity: 0,
          y: 6
        }} animate={{
          opacity: 1,
          y: 0
        }} exit={{
          opacity: 0,
          y: -4
        }} transition={{
          type: 'spring',
          stiffness: 320,
          damping: 28
        }} className="h-full overflow-y-auto overscroll-contain scrollbar-hide">
              <div className="bg-white dark:bg-slate-800 p-5 space-y-5">
                <QuestionManager sessionId={s.sessionId} questions={s.session?.questions || {}} currentQuestion={s.session?.currentQuestion} scores={s.scores} participants={s.participants} pendingEvent={s.session?.pendingEvent || null} readOnly={s.effectiveReadOnly} formOpen={s.showCenterForm} onAddClick={s.effectiveReadOnly ? undefined : () => {
              s.handleShowCenterForm();
              setActiveTab('results');
            }} onEditClick={s.effectiveReadOnly ? undefined : qId => {
              s.handleEditQuestion(qId);
              setActiveTab('results');
            }} onViewQuestion={qId => {
              s.handleViewQuestion(qId);
              setActiveTab('results');
            }} adminUid={s.adminUser?.uid} speedQuizActive={s.speedQuizActive} onStartSpeedQuiz={s.startSpeedQuiz} onEndSpeedQuiz={s.endSpeedQuiz} speedQuizCount={s.speedQuizCount} mobileStickyProgress />
              </div>
            </motion.div>}

          {activeTab === 'results' && <motion.div key="results" initial={{
          opacity: 0,
          y: 6
        }} animate={{
          opacity: 1,
          y: 0
        }} exit={{
          opacity: 0,
          y: -4
        }} transition={{
          type: 'spring',
          stiffness: 320,
          damping: 28
        }} className="h-full flex flex-col overflow-y-auto overscroll-contain scrollbar-hide">
              <div className="bg-white dark:bg-slate-800 flex-1 p-5 flex flex-col">
                <CenterContent showCenterForm={s.showCenterForm} onHideCenterForm={s.handleHideCenterForm} onCenterFormSubmit={s.handleCenterFormSubmit} editingQuestion={s.editingQuestion} effectiveReadOnly={s.effectiveReadOnly} session={s.session} currentMode={currentMode} sessionId={s.sessionId} onlineList={s.onlineList} leaderboard={s.leaderboard} drawParticipants={s.drawParticipants} participants={s.participants} scores={s.scores} count={s.count} onGameResult={handleGameResult} />
              </div>
            </motion.div>}

          {activeTab === 'participants' && <motion.div key="participants" initial={{
          opacity: 0,
          y: 6
        }} animate={{
          opacity: 1,
          y: 0
        }} exit={{
          opacity: 0,
          y: -4
        }} transition={{
          type: 'spring',
          stiffness: 320,
          damping: 28
        }} className="h-full overflow-y-auto overscroll-contain scrollbar-hide">
              <MobileParticipantsTab sessionId={s.sessionId} session={s.session} onlineList={s.onlineList} count={s.count} participants={s.participants} studentUrl={s.studentUrl} />
            </motion.div>}

          {activeTab === 'chat' && <motion.div key="chat" initial={{
          opacity: 0,
          y: 6
        }} animate={{
          opacity: 1,
          y: 0
        }} exit={{
          opacity: 0,
          y: -4
        }} transition={{
          type: 'spring',
          stiffness: 320,
          damping: 28
        }} className="h-full">
              <ChatPanel sessionId={s.sessionId} senderName={s.adminUser?.displayName || '강사'} senderType="instructor" open={true} onClose={() => setActiveTab('results')} onNewMessage={handleNewChatMessage} inline />
            </motion.div>}
        </AnimatePresence>
      </div>

      {/* Mode picker bottom sheet (grid, one-tap) */}
      <MobileModePicker open={modesOpen} onClose={() => setModesOpen(false)} currentMode={currentMode} onSwitchMode={mode => {
      s.switchMode(mode);
      setActiveTab('results');
    }} leaderboard={s.leaderboard} />

      {/* Session settings bottom sheet */}
      <BottomSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} ariaLabel="세션 설정">
        <div className="space-y-5">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">세션 설정</h3>
          {s.session?.status === 'active' && <button onClick={() => {
          setSettingsOpen(false);
          setTimeout(() => {
            if (window.confirm('수업을 종료하시겠습니까?')) s.handleEndSession();
          }, 100);
        }} className="w-full py-3 rounded-xl text-red-500 font-medium text-[15px] bg-slate-50 dark:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600 transition-colors duration-150">
              수업 종료
            </button>}
          {s.isReviewing && <button onClick={() => {
          setSettingsOpen(false);
          s.handleFullEndSession();
        }} className="w-full py-3 rounded-xl text-red-500 font-medium text-[15px] bg-slate-50 dark:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600 transition-colors duration-150">
              완전 종료
            </button>}

        </div>
      </BottomSheet>

      <MobileTabBar activeTab={activeTab} onTabChange={setActiveTab} hasUnreadChat={s.hasUnreadChat} />
    </div>;
}
