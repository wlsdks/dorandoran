import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { StickyNote, Hand, AlertCircle, HelpCircle, MessageSquare } from 'lucide-react';
import InstructorNotes, { useNotesState } from './InstructorNotes';
import HandRaiseList from '@/features/hand-raise/components/HandRaiseList';
import UrgentQuestionList from '@/features/questions/components/UrgentQuestionList';
import ClassQuestionList from '@/features/class-questions/components/ClassQuestionList';
import { useHandRaises } from '@/features/hand-raise/api/useHandRaises';
import { useUrgentQuestions } from '@/features/questions/api/useUrgentQuestions';
import { useClassQuestions } from '@/features/class-questions/api/useClassQuestions';
import StaffDMAlert from '@/features/dm/components/StaffDMAlert';
import { useStaffDMs } from '@/features/dm/api/useStaffDMs';
import { getStaffSession } from '@/lib/auth-session';

// 소통 종류별 탭. 비활성 패널도 유지해 메모 초안과 질문 선택 상태를 보존한다.

const TABS = [
  { id: 'notes', label: '메모', icon: StickyNote },
  { id: 'hands', label: '손들기', icon: Hand },
  { id: 'urgent', label: '긴급', icon: AlertCircle, urgent: true },
  { id: 'class', label: '수업 질문', icon: HelpCircle },
  // 학생 1:1 도움 요청 — 스태프가 없는 수업에서도 강사가 받는다
  { id: 'dm', label: '1:1 도움', icon: MessageSquare, urgent: true },
];

function TabButton({ active, onClick, icon: Icon, label, count = 0, urgent = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={`relative shrink-0 min-h-9 flex items-center justify-center gap-1 px-2.5 rounded-lg whitespace-nowrap text-xs font-semibold transition-colors duration-150 ${
        active
          ? 'bg-slate-100 text-slate-900 ring-1 ring-slate-300 dark:bg-slate-800 dark:text-white dark:ring-slate-600'
          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200'
      }`}
    >
      <Icon size={13} className={active ? '' : 'text-slate-400'} aria-hidden="true" />
      <span className="truncate">{label}</span>
      {count > 0 && (
        <motion.span
          key={count}
          initial={{ scale: 1.3 }}
          animate={{ scale: 1 }}
          className={`inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold ${
            urgent
              ? 'bg-red-500 text-white animate-pulse'
              : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
          }`}
        >
          {count}
        </motion.span>
      )}
    </button>
  );
}

export default memo(function InstructorCommHub({ sessionId }) {
  const [activeTab, setActiveTab] = useState('notes');

  // 배지 카운트용 훅
  const { count: handCount } = useHandRaises(sessionId);
  const { unreadCount: urgentCount } = useUrgentQuestions(sessionId);
  const { unansweredCount: classCount } = useClassQuestions(sessionId);
  const { unreadCount: notesUnread } = useNotesState(sessionId);
  const { waitingDMs } = useStaffDMs(sessionId);
  const me = getStaffSession();

  // 긴급 질문은 pulsing 빨간 배지로 시선 유도 — 강제 탭 전환은 강사가 현재 작업 중인 탭을 방해할 수 있어 배제
  const counts = { notes: notesUnread, hands: handCount, urgent: urgentCount, class: classCount, dm: waitingDMs.length };

  return (
    <section className="space-y-3" aria-label="학습자 소통">
      {/* Tabs */}
      <div role="tablist" aria-label="강사 소통" className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <TabButton
            key={t.id}
            active={activeTab === t.id}
            onClick={() => setActiveTab(t.id)}
            icon={t.icon}
            label={t.label}
            count={counts[t.id] || 0}
            urgent={t.urgent}
          />
        ))}
      </div>

      {/* Body — 탭별 내용. 모든 탭을 항상 마운트하고 display 토글로 숨김.
          이유: 탭별 Modal(selectedQuestion)이 열린 상태로 다른 탭 누르면 상태 소실되던 UX 버그 방지. */}
      <div>
        <div hidden={activeTab !== 'notes'} inert={activeTab !== 'notes'} role="tabpanel" aria-label="메모">
          <InstructorNotes sessionId={sessionId} embedded />
        </div>
        <div hidden={activeTab !== 'hands'} inert={activeTab !== 'hands'} role="tabpanel" aria-label="손들기">
          <HandRaiseList sessionId={sessionId} embedded />
        </div>
        <div hidden={activeTab !== 'urgent'} inert={activeTab !== 'urgent'} role="tabpanel" aria-label="긴급 질문">
          <UrgentQuestionList sessionId={sessionId} embedded />
        </div>
        <div hidden={activeTab !== 'class'} inert={activeTab !== 'class'} role="tabpanel" aria-label="수업 질문">
          <ClassQuestionList sessionId={sessionId} embedded />
        </div>
        <div hidden={activeTab !== 'dm'} inert={activeTab !== 'dm'} role="tabpanel" aria-label="1:1 도움">
          <StaffDMAlert sessionId={sessionId} staffId={me?.uid} staffName={me?.displayName || '강사'} senderType="instructor" inline />
          {waitingDMs.length === 0 && <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">학생의 1:1 도움 요청이 여기 표시돼요</p>}
        </div>
      </div>
    </section>
  );
});
