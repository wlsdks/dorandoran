import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { StickyNote, Hand, AlertCircle, HelpCircle } from 'lucide-react';
import InstructorNotes, { useNotesState } from './InstructorNotes';
import HandRaiseList from '@/features/hand-raise/components/HandRaiseList';
import UrgentQuestionList from '@/features/questions/components/UrgentQuestionList';
import ClassQuestionList from '@/features/class-questions/components/ClassQuestionList';
import { useHandRaises } from '@/features/hand-raise/api/useHandRaises';
import { useUrgentQuestions } from '@/features/questions/api/useUrgentQuestions';
import { useClassQuestions } from '@/features/class-questions/api/useClassQuestions';
import CollapsibleSection from './CollapsibleSection';

/**
 * 강사 우측 소통 허브 — 메모/손들기/긴급질문/수업질문을 하나의 카드 안 탭으로 통합.
 * 배경: 4개 개별 아코디언 카드가 쌓여 우측 패널이 지저분해짐 → 세로 긴 단일 카드 + 탭 전환.
 * 배지 카운트는 각 탭 헤더에 표시 — 새로 들어온 항목 놓치지 않도록.
 */

const TABS = [
  { id: 'notes', label: '메모', icon: StickyNote },
  { id: 'hands', label: '손들기', icon: Hand },
  { id: 'urgent', label: '긴급', icon: AlertCircle, urgent: true },
  { id: 'class', label: '수업 질문', icon: HelpCircle },
];

function TabButton({ active, onClick, icon: Icon, label, count = 0, urgent = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={`relative flex-1 min-w-0 min-h-11 flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-semibold transition-colors duration-150 ${
        active
          ? 'text-slate-900 dark:text-slate-100'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
      }`}
    >
      <Icon size={13} className={active ? '' : 'text-slate-400'} />
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
      {active && (
        <motion.span
          layoutId="comm-hub-underline"
          className="absolute inset-x-2 bottom-0 h-[2px] bg-slate-900 dark:bg-slate-100 rounded-full"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
    </button>
  );
}

export default memo(function InstructorCommHub({ sessionId }) {
  const [selectedTab, setActiveTab] = useState(null);

  // 배지 카운트용 훅
  const { count: handCount, raisedList } = useHandRaises(sessionId);
  const { unreadCount: urgentCount, questionList: urgentQuestions } = useUrgentQuestions(sessionId);
  const { unansweredCount: classCount, questions: classQuestions } = useClassQuestions(sessionId);
  const { unreadCount: notesUnread } = useNotesState(sessionId);

  // 긴급 질문은 pulsing 빨간 배지로 시선 유도 — 강제 탭 전환은 강사가 현재 작업 중인 탭을 방해할 수 있어 배제
  const counts = { notes: notesUnread, hands: handCount, urgent: urgentCount, class: classCount };

  // 접혔을 때 헤더에 노출할 요약 — 0 초과 카운트만 간결하게 나열
  const summaryParts = [];
  if (urgentCount > 0) summaryParts.push(`긴급 ${urgentCount}`);
  if (handCount > 0) summaryParts.push(`손들기 ${handCount}`);
  if (classCount > 0) summaryParts.push(`질문 ${classCount}`);
  if (notesUnread > 0) summaryParts.push(`메모 ${notesUnread}`);
  const summary = summaryParts.length > 0 ? summaryParts.join(' · ') : '새 항목 없음';
  const hasUrgent = urgentCount > 0;
  const activeTab = selectedTab || (urgentCount > 0 ? 'urgent' : handCount > 0 ? 'hands' : classCount > 0 ? 'class' : 'hands');
  // 처리/삭제로 수가 줄어드는 일은 다시 펼치지 않는다. 새로운 요청 ID/시각만 펼침을 유발한다.
  const autoOpenKeys = [
    ...raisedList.map(item => `${sessionId}:hand:${item.id}:${item.raisedAt || 0}`),
    ...urgentQuestions.filter(item => !item.read).map(item => `${sessionId}:urgent:${item.id}`),
    ...classQuestions.filter(item => !item.answered).map(item => `${sessionId}:class:${item.id}`),
  ];

  return (
    <CollapsibleSection title="학습자 요청" summary={summary} attention={hasUrgent} defaultOpen={false} autoOpenKeys={autoOpenKeys}>
      {/* Tabs */}
      <div role="tablist" aria-label="강사 소통" className="flex items-stretch border-b border-slate-100 dark:border-slate-700">
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
      <div className="p-3.5">
        <div className={activeTab === 'notes' ? '' : 'hidden'}>
          <InstructorNotes sessionId={sessionId} embedded />
        </div>
        <div className={activeTab === 'hands' ? '' : 'hidden'}>
          <HandRaiseList sessionId={sessionId} embedded />
        </div>
        <div className={activeTab === 'urgent' ? '' : 'hidden'}>
          <UrgentQuestionList sessionId={sessionId} embedded />
        </div>
        <div className={activeTab === 'class' ? '' : 'hidden'}>
          <ClassQuestionList sessionId={sessionId} embedded />
        </div>
      </div>
    </CollapsibleSection>
  );
});
