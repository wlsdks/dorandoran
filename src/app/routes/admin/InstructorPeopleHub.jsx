import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, UserCog } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import ParticipantList from '@/features/participants/components/ParticipantList';
import { useStaffAssignment } from '@/features/course/api/useStaffAssignment';
import CollapsibleSection from './CollapsibleSection';

/**
 * 인원 허브 — 참여자(학생) + 스태프를 한 카드 안 탭으로 통합.
 * 기존: [스태프] 아코디언 카드 + [참여자 목록] 아코디언 카드 2장 → 세로로 지저분
 * 개선: 카드 1장, 상단 탭([참여자 | 스태프]), 카드 전체는 CollapsibleSection으로 접기/펼치기
 */

function TabButton({ active, onClick, icon: Icon, label, count = 0 }) {
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
        <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
          {count}
        </span>
      )}
      {active && (
        <motion.span
          layoutId="people-hub-underline"
          className="absolute inset-x-2 bottom-0 h-[2px] bg-slate-900 dark:bg-slate-100 rounded-full"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
    </button>
  );
}

function StaffPanel({ staffList }) {
  if (!staffList?.length) {
    return <p className="text-xs text-slate-400 py-2 text-center">배정된 스태프가 없습니다</p>;
  }
  return (
    <div className="space-y-1.5">
      {staffList.map((s) => (
        <div key={s.uid} className="flex items-center gap-2 py-1">
          <Avatar name={s.displayName} size="xs" />
          <span className="text-sm text-slate-700 dark:text-slate-300">{s.displayName}</span>
        </div>
      ))}
    </div>
  );
}

export default memo(function InstructorPeopleHub({ onlineList, voteCounts, courseId, peopleLabel = '참여자' }) {
  const [activeTab, setActiveTab] = useState('participants');
  const { staffList } = useStaffAssignment(courseId);

  const participantCount = onlineList?.length || 0;
  const staffCount = staffList?.length || 0;

  // courseId 없으면 스태프 탭 숨김 (단일 탭이면 탭 UI 없이 바로 참여자 목록)
  const hasStaff = !!courseId;

  const summaryParts = [];
  if (participantCount > 0) summaryParts.push(`${peopleLabel} ${participantCount}`);
  if (hasStaff && staffCount > 0) summaryParts.push(`스태프 ${staffCount}`);
  // 추첨 전용 세션에는 접속이라는 개념이 없다 — 라벨에 맞춰 빈 상태 문구도 바꾼다
  const emptyLabel = peopleLabel === '참여자' ? '아직 접속 전' : '명단 없음';
  const summary = summaryParts.length > 0 ? summaryParts.join(' · ') : emptyLabel;

  return (
    <CollapsibleSection title="인원" summary={summary} defaultOpen={false}>
      {hasStaff && (
        <div role="tablist" aria-label="인원" className="flex items-stretch border-b border-slate-100 dark:border-slate-700">
          <TabButton
            active={activeTab === 'participants'}
            onClick={() => setActiveTab('participants')}
            icon={Users}
            label={peopleLabel}
            count={participantCount}
          />
          <TabButton
            active={activeTab === 'staff'}
            onClick={() => setActiveTab('staff')}
            icon={UserCog}
            label="스태프"
            count={staffCount}
          />
        </div>
      )}

      {/* Body — 탭 있으면 hidden 토글로 상태 보존 (InstructorCommHub와 동일 패턴).
          참여자 탭의 ParticipantList 내부 expanded("더보기") 상태가 탭 전환 시 사라지지 않도록. */}
      <div className="p-3.5">
        {hasStaff ? (
          <>
            <div className={activeTab === 'participants' ? '' : 'hidden'}>
              <ParticipantList participants={onlineList || []} voteCounts={voteCounts} />
            </div>
            <div className={activeTab === 'staff' ? '' : 'hidden'}>
              <StaffPanel staffList={staffList} />
            </div>
          </>
        ) : (
          <ParticipantList participants={onlineList || []} voteCounts={voteCounts} />
        )}
      </div>
    </CollapsibleSection>
  );
});
