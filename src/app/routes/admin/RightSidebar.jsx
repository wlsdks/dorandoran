import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ChevronDown, Copy, Check, Monitor, Ticket, ListPlus } from 'lucide-react';
import ParticipantList from '@/features/participants/components/ParticipantList';
import EventStats from '@/features/participants/components/EventStats';
import RosterModal from '@/features/participants/components/RosterModal';
import QRCode from '@/components/ui/QRCode';
import Leaderboard from '@/features/quiz/components/Leaderboard';
import InstructorCommHub from './InstructorCommHub';
import InstructorPeopleHub from './InstructorPeopleHub';
import Button from '@/components/ui/Button';

function RightPanelAccordion({ title, count, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full min-h-11 flex items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600 transition-colors duration-150"
        aria-expanded={open}
        aria-label={`${title} ${open ? '접기' : '펼치기'}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 tracking-tight">{title}</span>
          {count > 0 && <span className="text-xs text-slate-400">{count}</span>}
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={14} className="text-slate-400" />
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActiveRightSidebar({ session, sessionId, count, participants, onlineList, leaderboard, voteCounts, studentUrl, courseId }) {
  const [copied, setCopied] = useState(false);
  const [liveCopied, setLiveCopied] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  // 추첨 전용 모드 — 입장하는 참여자가 없다. 초대 QR 대신 명단 입력이 그 자리를 대신한다.
  const drawOnly = !!session?.drawOnly;

  async function copyStudentLink() {
    try {
      await navigator.clipboard.writeText(studentUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function copyLiveUrl() {
    try {
      const liveUrl = `${window.location.origin}/live?s=${sessionId}`;
      await navigator.clipboard.writeText(liveUrl);
      setLiveCopied(true);
      window.setTimeout(() => setLiveCopied(false), 2000);
    } catch {
      setLiveCopied(false);
    }
  }

  const activeQId = session?.currentQuestion;
  const activeQ = activeQId ? session?.questions?.[activeQId] : null;
  const voted = activeQ?.votes ? Object.keys(activeQ.votes).length : 0;
  const total = count || 0;
  const pct = total > 0 ? Math.min(100, Math.round((voted / total) * 100)) : 0;

  return (
    <>
      <div className="flex items-center gap-2">
        {drawOnly ? (
          <Ticket size={16} className="text-slate-400" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        )}
        <motion.span key={count} initial={{ scale: 1.15 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 22 }} className="text-slate-900 dark:text-slate-100 font-bold text-2xl tabular-nums tracking-tight inline-block">{count}</motion.span>
        <span className="text-slate-500 dark:text-slate-400 text-xs">{drawOnly ? '명 추첨 대상' : '명 접속 중'}</span>
      </div>

      {drawOnly && (
        <div className="space-y-2">
          <Button onClick={() => setRosterOpen(true)} variant="primary" size="sm" className="w-full">
            <ListPlus size={15} />
            명단 관리
          </Button>
          <p className="text-slate-400 text-xs leading-relaxed">
            이름과 사번을 직접 입력하거나 엑셀에서 붙여넣어 추첨 대상을 만듭니다.
          </p>
          <RosterModal
            open={rosterOpen}
            onClose={() => setRosterOpen(false)}
            sessionId={sessionId}
            participants={participants}
          />
        </div>
      )}

      {/* 기업 행사모드: 사번 등록 통계 */}
      {session?.requireEmployeeId && <EventStats participants={onlineList} count={count} variant="sidebar" />}

      {activeQ && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">참여율</span>
            <span className="text-slate-600 dark:text-slate-300 text-xs font-semibold">{voted}/{total}명 투표</span>
          </div>
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`참여율 ${pct}%`}>
            <motion.div
              className="h-full bg-indigo-500 dark:bg-indigo-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            />
          </div>
        </div>
      )}

      {/* 메모 / 손들기 / 긴급 / 수업질문 — 탭 통합 */}
      <InstructorCommHub sessionId={sessionId} />

      {/* Leaderboard accordion */}
      {leaderboard.length > 0 && (
        <RightPanelAccordion title="상위 랭킹" count={leaderboard.length} defaultOpen={false}>
          <Leaderboard entries={leaderboard} maxShow={5} title={null} />
        </RightPanelAccordion>
      )}

      {/* 참여자 + 스태프 — 탭 통합 */}
      <InstructorPeopleHub
        onlineList={onlineList}
        voteCounts={voteCounts}
        courseId={courseId}
        peopleLabel={drawOnly ? '명단' : '참여자'}
      />

      {/* QR — 추첨 전용 모드에서는 입장할 학생이 없으므로 숨긴다. 전자칠판 링크는 추첨 화면용으로 남긴다. */}
      <details className="group rounded-xl border border-slate-200 dark:border-slate-700" open={!drawOnly && count === 0 || undefined}>
        <summary className="min-h-11 flex items-center justify-between cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 [&::-webkit-details-marker]:hidden">
          참여 초대 / 전자칠판
          <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-4 pb-4">
        {!drawOnly && (
          <>
            <div className="flex justify-center">
              <QRCode url={studentUrl} size={160} />
            </div>
            <Button onClick={copyStudentLink} variant="secondary" size="sm" className="w-full mt-3">
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? '링크 복사됨' : '초대 링크 복사'}
            </Button>
          </>
        )}
        <Button onClick={copyLiveUrl} variant="secondary" size="sm" className={`w-full ${drawOnly ? '' : 'mt-2'}`}>
          {liveCopied ? <Check size={14} /> : <Monitor size={14} />}
          {liveCopied ? '링크 복사됨' : '전자칠판 링크 복사'}
        </Button>
        {!drawOnly && (
          <p className="text-slate-400 text-xs mt-2 text-center break-all leading-relaxed">{studentUrl}</p>
        )}
        </div>
      </details>
    </>
  );
}

function ReadOnlyRightSidebar({ session, participants, leaderboard, voteCounts }) {
  const allParticipants = Object.keys(participants).length;
  const questions = session?.questions || {};
  const voterIds = new Set();
  Object.values(questions).forEach((q) => {
    if (q.votes) {
      Object.keys(q.votes).forEach((pid) => voterIds.add(pid));
    }
  });
  // votes에 stale ID(참여자 노드 제거 후 잔존)가 있어도 현재 participants 등록자만 카운트
  // → activeCount > allParticipants anomaly 회피
  const activeCount = Array.from(voterIds).filter((pid) => participants[pid]).length;
  const pct = allParticipants > 0 ? Math.min(100, Math.round((activeCount / allParticipants) * 100)) : 0;

  return (
    <>
      <div className="flex items-center gap-2">
        <Users size={16} className="text-slate-400" />
        <span className="text-slate-900 dark:text-slate-100 font-bold text-lg">{allParticipants}</span>
        <span className="text-slate-400 text-sm">명 참여</span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">
            참여율 <span className="text-slate-700 dark:text-slate-200 font-semibold tabular-nums">{pct}%</span>
          </span>
          <span className="text-slate-500 dark:text-slate-400 text-xs">{activeCount}명 응답 / {allParticipants}명 참여</span>
        </div>
        <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`참여율 ${pct}%`}>
          <div
            className="h-full bg-slate-700 dark:bg-slate-300 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {leaderboard.length > 0 && (
        <RightPanelAccordion title="상위 랭킹" count={leaderboard.length} defaultOpen={false}>
          <Leaderboard entries={leaderboard} maxShow={5} title={null} />
        </RightPanelAccordion>
      )}
      <RightPanelAccordion title="참여자 목록" count={Object.keys(participants).length} defaultOpen={false}>
        <ParticipantList participants={Object.entries(participants).map(([id, data]) => ({ id, ...data }))} voteCounts={voteCounts} />
      </RightPanelAccordion>
    </>
  );
}

export default memo(function RightSidebar({
  session,
  sessionId,
  effectiveReadOnly,
  participants,
  onlineList,
  count,
  leaderboard,
  voteCounts,
  studentUrl,
  sidebarCollapsed,
  isDrawer = false,
  courseId,
}) {
  const content = effectiveReadOnly ? (
    <ReadOnlyRightSidebar
      session={session}
      participants={participants}
      leaderboard={leaderboard}
      voteCounts={voteCounts}
    />
  ) : (
    <ActiveRightSidebar
      session={session}
      sessionId={sessionId}
      count={count}
      participants={participants}
      onlineList={onlineList}
      leaderboard={leaderboard}
      voteCounts={voteCounts}
      studentUrl={studentUrl}
      courseId={courseId}
    />
  );

  // In drawer mode, content is rendered by parent — no wrapper needed
  if (isDrawer) return content;

  return (
    <motion.div
      animate={{ width: sidebarCollapsed ? 0 : '28%', minWidth: sidebarCollapsed ? 0 : 280 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shrink-0 min-w-0 max-w-[460px] h-full"
    >
      <div className="min-w-[280px] p-5 space-y-5 overflow-y-auto h-full scrollbar-hide">
        {content}
      </div>
    </motion.div>
  );
});
