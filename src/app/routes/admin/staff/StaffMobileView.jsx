import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, MessageCircle, Hand, MessageSquare, Users, LogOut, FileText, Coffee, Trophy, Award, BarChart3 } from 'lucide-react';
import { useParticipants } from '@/features/participants/api/useParticipants';
import StaffDMAlert from '@/features/dm/components/StaffDMAlert';
import StaffQuestionsTab from './StaffQuestionsTab';
import StaffHandRaisesTab from './StaffHandRaisesTab';
import StaffChatTab from './StaffChatTab';
import StaffParticipantsTab from './StaffParticipantsTab';

const TABS = [
  { key: 'questions', label: '질문', icon: MessageCircle },
  { key: 'handRaise', label: '손들기', icon: Hand },
  { key: 'chat', label: '채팅', icon: MessageSquare },
  { key: 'participants', label: '참여자', icon: Users },
];

// P2-3: 강사 진행 상황을 스태프가 한눈에 — 현재 active 질문 또는 mode 안내
const MODE_LABEL = {
  lottery: { label: '추첨 진행 중', Icon: Trophy },
  breakTime: { label: '쉬는 시간', Icon: Coffee },
  leaderboard: { label: '랭킹', Icon: Trophy },
  awards: { label: '시상식', Icon: Award },
  randomPicker: { label: '발표자 뽑기', Icon: Users },
  comprehension: { label: '이해도 체크', Icon: BarChart3 },
  quickSurvey: { label: '빠른 설문', Icon: BarChart3 },
  discussion: { label: '그룹 토론', Icon: MessageSquare },
  qaBoard: { label: 'Q&A 보드', Icon: MessageSquare },
  qaRanking: { label: 'Q&A 랭킹', Icon: Trophy },
  combinedRanking: { label: '합산 랭킹', Icon: Trophy },
  joinShow: { label: '접속 현황', Icon: Users },
  focus: { label: '집중 모드', Icon: Users },
};

function CurrentContext({ session }) {
  const currentMode = session?.currentMode;
  const currentQId = session?.currentQuestion;
  const question = currentQId ? session?.questions?.[currentQId] : null;
  const modeMeta = currentMode ? MODE_LABEL[currentMode] : null;

  // 진행 중 질문이 있으면 우선 표시, 그 다음 special mode, 그 외 대기
  const content = question
    ? { Icon: FileText, primary: question.title || '제목 없음', secondary: '현재 질문' }
    : modeMeta
      ? { Icon: modeMeta.Icon, primary: modeMeta.label, secondary: null }
      : { Icon: Coffee, primary: '대기 중', secondary: '강사 진행 대기' };

  const { Icon } = content;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${currentMode}-${currentQId}`}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18 }}
        className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2 shrink-0"
        aria-live="polite"
      >
        <Icon size={14} className="text-slate-500 dark:text-slate-400 shrink-0" />
        {content.secondary && (
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0">
            {content.secondary}
          </span>
        )}
        <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200 truncate flex-1">
          {content.primary}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}

export default function StaffMobileView({ sessionId, session, adminUser, onBack, onLogout }) {
  const [activeTab, setActiveTab] = useState('questions');
  const { count } = useParticipants(sessionId);
  const courseName = session?.courseName || '도란도란';
  const round = session?.roundNumber ? `${session.roundNumber}차` : '';

  return (
    <div className="h-dvh bg-slate-50 dark:bg-slate-900 flex flex-col overflow-hidden">
      {/* Header — mobile app style (no border, backdrop blur) */}
      <header className="bg-white dark:bg-slate-800 shrink-0">
        <div className="flex items-center gap-3 px-5 py-3.5">
          <button onClick={activeTab !== 'questions' ? () => setActiveTab('questions') : onBack}
            className="p-2 -ml-2 rounded-xl text-slate-500 dark:text-slate-400 active:bg-slate-100 dark:active:bg-slate-700 transition-colors duration-150"
            aria-label="뒤로가기">
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate tracking-tight">
              {courseName} {round}
            </h1>
            <div className="flex items-center gap-1.5 text-[13px] text-slate-500 dark:text-slate-400">
              <span><motion.span key={count} initial={{ scale: 1.15 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 22 }} className="inline-block tabular-nums">{count}</motion.span>명 접속</span>
              <span>·</span>
              <span>스태프</span>
            </div>
          </div>
          {onLogout && (
            <button onClick={onLogout}
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 active:bg-slate-100 dark:active:bg-slate-700 transition-colors duration-150"
              aria-label="로그아웃">
              <LogOut size={18} />
            </button>
          )}
        </div>
      </header>

      {/* P2-3: 강사 현재 진행 상황 — 질문 변경 시 자동 갱신 */}
      <CurrentContext session={session} />

      {/* Tablet staff have no desktop right panel: keep their active help
          conversations reachable, without covering the header controls. */}
      <StaffDMAlert
        sessionId={sessionId}
        staffId={adminUser?.uid}
        staffName={adminUser?.displayName || '스태프'}
        senderType="staff"
        inline
      />

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        <div className={`h-full ${activeTab === 'chat' ? 'flex flex-col' : 'overflow-y-auto overscroll-contain scrollbar-hide'}`}>
          <div className={`w-full min-h-full ${activeTab === 'chat' ? 'flex-1 flex flex-col min-h-0' : 'px-5 py-5 space-y-4 flex flex-col'}`}>
            {activeTab === 'questions' && <StaffQuestionsTab sessionId={sessionId} adminUser={adminUser} />}
            {activeTab === 'handRaise' && <StaffHandRaisesTab sessionId={sessionId} />}
            {activeTab === 'chat' && (
              <StaffChatTab sessionId={sessionId} senderName={adminUser?.displayName || '스태프'} />
            )}
            {activeTab === 'participants' && <StaffParticipantsTab sessionId={sessionId} />}
          </div>
        </div>
      </div>

      {/* Bottom tab bar (same pattern as instructor mobile) */}
      <div className="flex bg-white dark:bg-slate-800 shrink-0"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <motion.button
              key={tab.key}
              whileTap={{ scale: 0.92 }}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-medium transition-colors duration-150 ${
                isActive
                  ? 'text-slate-900 dark:text-slate-100'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon size={24} strokeWidth={isActive ? 2 : 1.5} />
              <span>{tab.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
