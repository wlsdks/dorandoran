import { useId, useState, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import { Users, MessageCircle, BarChart3, Copy, Check, Monitor, ListPlus } from 'lucide-react';
import ParticipantList from '@/features/participants/components/ParticipantList';
import EventStats from '@/features/participants/components/EventStats';
import RosterModal from '@/features/participants/components/RosterModal';
import QRCode from '@/components/ui/QRCode';
import Leaderboard from '@/features/quiz/components/Leaderboard';
import InstructorCommHub from './InstructorCommHub';
import InstructorPeopleHub from './InstructorPeopleHub';
import Button from '@/components/ui/Button';
import { isResponseQuestion, questionParticipationKind } from '@/lib/response-questions';

const SIDEBAR_TABS = [
  { id: 'communication', label: '소통', icon: MessageCircle },
  { id: 'people', label: '참여자', icon: Users },
  { id: 'status', label: '현황', icon: BarChart3 },
];

function SidebarTabs({ activeTab, onChange, id }) {
  function handleKeyDown(event) {
    const current = SIDEBAR_TABS.findIndex((tab) => tab.id === activeTab);
    let next;
    if (event.key === 'ArrowRight') next = (current + 1) % SIDEBAR_TABS.length;
    else if (event.key === 'ArrowLeft') next = (current + SIDEBAR_TABS.length - 1) % SIDEBAR_TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = SIDEBAR_TABS.length - 1;
    else return;
    event.preventDefault();
    onChange(SIDEBAR_TABS[next].id);
    event.currentTarget.querySelectorAll('[role="tab"]')[next]?.focus();
  }

  return (
    <div role="tablist" aria-label="수업 관리 패널" onKeyDown={handleKeyDown} className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 dark:bg-slate-900/50 p-1">
      {SIDEBAR_TABS.map(({ id: tabId, label, icon: Icon }) => (
        <button key={tabId} type="button" role="tab" id={`${id}-tab-${tabId}`} aria-controls={`${id}-panel-${tabId}`} aria-selected={activeTab === tabId} tabIndex={activeTab === tabId ? 0 : -1} onClick={() => onChange(tabId)}
          className={`min-h-11 flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === tabId ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
          <Icon size={16} />{label}
        </button>
      ))}
    </div>
  );
}

const SidebarPanel = memo(function SidebarPanel({ id, tab, activeTab, children }) {
  const hidden = tab !== activeTab;
  const [visited, setVisited] = useState(!hidden);
  useEffect(() => { if (!hidden) setVisited(true); }, [hidden]);
  if (hidden && !visited) return null;
  return <div id={`${id}-panel-${tab}`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`} hidden={hidden} inert={hidden} className="space-y-5">{children}</div>;
}, (previous, next) => previous.id === next.id && previous.tab === next.tab && previous.tab !== previous.activeTab && next.tab !== next.activeTab);

function ActiveRightSidebar({ session, sessionId, count, participants, onlineList, leaderboard, voteCounts, studentUrl, courseId }) {
  const id = useId();
  const [activeTab, setActiveTab] = useState('communication');
  const [copied, setCopied] = useState(false);
  const [liveCopied, setLiveCopied] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const drawOnly = !!session?.drawOnly;

  async function copyStudentLink() {
    try {
      await navigator.clipboard.writeText(studentUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { setCopied(false); }
  }

  async function copyLiveUrl() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/live?s=${sessionId}`);
      setLiveCopied(true);
      window.setTimeout(() => setLiveCopied(false), 2000);
    } catch { setLiveCopied(false); }
  }

  const activeQ = session?.currentQuestion ? session?.questions?.[session.currentQuestion] : null;
  const activeKind = questionParticipationKind(activeQ);
  const voted = activeQ?.votes ? Object.keys(activeQ.votes).length : 0;
  const total = count || 0;
  const pct = total > 0 ? Math.min(100, Math.round((voted / total) * 100)) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        {drawOnly ? <Users size={20} className="text-slate-400" /> : <div className="w-2 h-2 rounded-full bg-emerald-400" />}
        <motion.span key={count} initial={{ scale: 1.15 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 22 }} className="text-slate-900 dark:text-slate-100 font-bold text-2xl tabular-nums tracking-tight">{count}</motion.span>
        <span className="text-slate-500 dark:text-slate-400 text-xs">{drawOnly ? '명 추첨 대상' : '명 접속 중'}</span>
      </div>
      <SidebarTabs id={id} activeTab={activeTab} onChange={setActiveTab} />
      <SidebarPanel id={id} tab="communication" activeTab={activeTab}>
        <InstructorCommHub sessionId={sessionId} />
      </SidebarPanel>
      <SidebarPanel id={id} tab="people" activeTab={activeTab}>
        {drawOnly && <div className="space-y-2">
          <Button onClick={() => setRosterOpen(true)} variant="secondary" size="sm" className="w-full h-12"><ListPlus size={20} />명단 관리</Button>
          <p className="text-slate-400 text-xs leading-relaxed">이름과 사번을 입력하거나 엑셀에서 붙여넣어 추첨 대상을 만듭니다.</p>
          <RosterModal open={rosterOpen} onClose={() => setRosterOpen(false)} sessionId={sessionId} participants={participants} />
        </div>}
        <InstructorPeopleHub onlineList={onlineList} voteCounts={voteCounts} courseId={courseId} peopleLabel={drawOnly ? '명단' : '참여자'} />
        {!drawOnly && <section className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3" aria-label="참여 초대">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">참여 초대</h3>
          <div className="flex justify-center"><QRCode url={studentUrl} size={144} /></div>
          <Button onClick={copyStudentLink} variant="secondary" size="sm" className="w-full h-12">{copied ? <Check size={20} /> : <Copy size={20} />}{copied ? '링크 복사됨' : '초대 링크 복사'}</Button>
          <p className="text-slate-400 text-xs text-center break-all leading-relaxed">{studentUrl}</p>
        </section>}
      </SidebarPanel>
      <SidebarPanel id={id} tab="status" activeTab={activeTab}>
        {isResponseQuestion(activeQ) ? <div className="space-y-2">
          <div className="flex items-center justify-between text-xs"><span className="text-slate-500 dark:text-slate-400 font-semibold">참여율 {pct}%</span><span className="text-slate-600 dark:text-slate-300">{voted}/{total}명 응답</span></div>
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`참여율 ${pct}%`}>
            <motion.div className="h-full bg-indigo-500 dark:bg-indigo-400 rounded-full" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 200, damping: 20 }} />
          </div>
        </div> : <p className="text-xs text-slate-500 dark:text-slate-400">{activeQ
          ? activeKind === 'material' ? '수업 자료 표시 중' : activeKind === 'submission' ? '개별 제출 활동 진행 중' : '활동 화면 표시 중'
          : '활동을 시작하면 참여 현황이 표시됩니다.'}</p>}
        {session?.requireEmployeeId && <EventStats participants={onlineList} count={count} variant="sidebar" />}
        {leaderboard.length > 0 && <section className="space-y-3" aria-label="상위 랭킹"><h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">상위 랭킹</h3><Leaderboard entries={leaderboard} maxShow={5} title={null} /></section>}
        <Button onClick={copyLiveUrl} variant="secondary" size="sm" className="w-full h-12">{liveCopied ? <Check size={20} /> : <Monitor size={20} />}{liveCopied ? '링크 복사됨' : '전자칠판 링크 복사'}</Button>
      </SidebarPanel>
    </div>
  );
}

function ReadOnlyRightSidebar({ session, participants, leaderboard, voteCounts }) {
  const id = useId();
  const [activeTab, setActiveTab] = useState('status');
  const allParticipants = Object.keys(participants).length;
  const responseQuestions = Object.values(session?.questions || {}).filter(isResponseQuestion);
  const voterIds = new Set();
  responseQuestions.forEach((q) => {
    Object.keys(q.votes || {}).forEach((pid) => voterIds.add(pid));
  });
  const activeCount = Array.from(voterIds).filter((pid) => participants[pid]).length;
  const pct = allParticipants > 0 ? Math.min(100, Math.round((activeCount / allParticipants) * 100)) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2"><Users size={20} className="text-slate-400" /><span className="text-slate-900 dark:text-slate-100 font-bold text-lg">{allParticipants}</span><span className="text-slate-400 text-sm">명 참여</span></div>
      <SidebarTabs id={id} activeTab={activeTab} onChange={setActiveTab} />
      <SidebarPanel id={id} tab="communication" activeTab={activeTab}><p className="text-xs text-slate-500 dark:text-slate-400">종료된 수업입니다. 참여자와 수업 현황을 확인할 수 있습니다.</p></SidebarPanel>
      <SidebarPanel id={id} tab="people" activeTab={activeTab}><ParticipantList participants={Object.entries(participants).map(([pid, data]) => ({ id: pid, ...data }))} voteCounts={voteCounts} /></SidebarPanel>
      <SidebarPanel id={id} tab="status" activeTab={activeTab}>
        {responseQuestions.length > 0 ? <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400"><span className="font-semibold">참여율 {pct}%</span><span>{activeCount}/{allParticipants}명 응답</span></div>
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`참여율 ${pct}%`}><div className="h-full bg-slate-700 dark:bg-slate-300 rounded-full" style={{ width: `${pct}%` }} /></div>
        </div> : <p className="text-xs text-slate-500 dark:text-slate-400">이 수업에는 응답형 활동이 없습니다.</p>}
        {leaderboard.length > 0 && <section className="space-y-3" aria-label="상위 랭킹"><h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">상위 랭킹</h3><Leaderboard entries={leaderboard} maxShow={5} title={null} /></section>}
      </SidebarPanel>
    </div>
  );
}

export default memo(function RightSidebar({ session, sessionId, effectiveReadOnly, participants, onlineList, count, leaderboard, voteCounts, studentUrl, sidebarCollapsed, isDrawer = false, courseId }) {
  const content = effectiveReadOnly
    ? <ReadOnlyRightSidebar key={sessionId} session={session} participants={participants} leaderboard={leaderboard} voteCounts={voteCounts} />
    : <ActiveRightSidebar key={sessionId} session={session} sessionId={sessionId} count={count} participants={participants} onlineList={onlineList} leaderboard={leaderboard} voteCounts={voteCounts} studentUrl={studentUrl} courseId={courseId} />;
  if (isDrawer) return content;
  return (
    <motion.div animate={{ width: sidebarCollapsed ? 0 : 'clamp(280px, 22vw, 320px)', minWidth: sidebarCollapsed ? 0 : 280 }} transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }} className="border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shrink-0 min-w-0 max-w-[460px] h-full">
      <div className="min-w-[280px] p-5 overflow-y-auto h-full scrollbar-hide">{content}</div>
    </motion.div>
  );
});
