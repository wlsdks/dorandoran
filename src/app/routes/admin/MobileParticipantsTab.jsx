import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Hand, AlertCircle, HelpCircle, Copy, Check, ChevronDown, Gift, ListPlus } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import RosterModal from '@/features/participants/components/RosterModal';
import EmptyState from '@/components/ui/EmptyState';
import { useHandRaises } from '@/features/hand-raise/api/useHandRaises';
import { useUrgentQuestions } from '@/features/questions/api/useUrgentQuestions';
import { useClassQuestions } from '@/features/class-questions/api/useClassQuestions';

/* ─── Section Accordion (토스 style: 독립 카드, 배경 대비) ─── */
function MobileSection({
  icon: Icon,
  title,
  count,
  children,
  defaultOpen = true
}) {
  const [open, setOpen] = useState(defaultOpen);
  return <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center justify-between px-5 py-4 active:bg-slate-50 dark:active:bg-slate-700/50 transition-colors duration-150">
        <span className="flex items-center gap-2.5 text-[16px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
          <Icon size={18} className="text-slate-400" />
          {title}
          {count > 0 && <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900">
              {count}
            </span>}
        </span>
        <motion.div animate={{
        rotate: open ? 180 : 0
      }} transition={{
        duration: 0.2
      }}>
          <ChevronDown size={18} className="text-slate-300 dark:text-slate-600" />
        </motion.div>
      </button>
      <AnimatePresence>
        {open && <motion.div initial={{
        height: 0,
        opacity: 0
      }} animate={{
        height: 'auto',
        opacity: 1
      }} exit={{
        height: 0,
        opacity: 0
      }} transition={{
        duration: 0.2
      }} className="overflow-hidden">
            <div className="px-5 pb-5">{children}</div>
          </motion.div>}
      </AnimatePresence>
    </div>;
}

/* ─── Participants Tab (토스 style: hero number, spacious lists) ─── */
export default function MobileParticipantsTab({
  sessionId,
  session,
  onlineList,
  count,
  participants,
  studentUrl
}) {
  const {
    raisedList,
    count: handCount
  } = useHandRaises(sessionId);
  const {
    questionList: urgentList,
    unreadCount: urgentCount
  } = useUrgentQuestions(sessionId);
  const {
    questions: classQuestions,
    unansweredCount
  } = useClassQuestions(sessionId);
  const [copied, setCopied] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  // 추첨 전용 모드 — 접속하는 학생이 없으므로 접속 현황 대신 명단이 기준이 된다.
  const drawOnly = !!session?.drawOnly;
  function handleCopy() {
    navigator.clipboard?.writeText(studentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return <div className="bg-slate-50 dark:bg-slate-900 min-h-full">
      {/* Hero stat */}
      <div className="px-4 pt-5">
        <div className="bg-white dark:bg-slate-800 rounded-2xl text-center py-7 shadow-sm">
          <div className="flex items-center justify-center gap-2 mb-2">
            {drawOnly ? <Gift size={15} className="text-slate-400" /> : <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />}
            <span className="text-[15px] text-slate-400">{drawOnly ? '추첨 명단' : '실시간 접속'}</span>
          </div>
          <motion.p key={count} initial={{
          scale: 1.1
        }} animate={{
          scale: 1
        }} className="text-5xl font-bold text-slate-900 dark:text-slate-100 tracking-tight tabular-nums">
            {count}
          </motion.p>
          <p className="text-[15px] text-slate-400 mt-1">{drawOnly ? '명 추첨 대상' : '명 접속 중'}</p>
        </div>
      </div>

      {/* 섹션들 — 독립 카드, 배경 대비로 영역 구분 (토스/당근 패턴) */}
      <div className="px-4 pt-4 pb-8 space-y-3">
        <MobileSection icon={Hand} title="손들기" count={handCount} defaultOpen={handCount > 0}>
          {handCount === 0 ? <p className="text-[15px] text-slate-400 text-center py-4">손든 학생이 없습니다</p> : <div className="space-y-1">
              {raisedList.map(p => <div key={p.id} className="flex items-center gap-3 py-3">
                  <Avatar name={p.nickname} size="md" />
                  <span className="text-[16px] font-medium text-slate-700 dark:text-slate-200">{p.nickname}</span>
                </div>)}
            </div>}
        </MobileSection>

        <MobileSection icon={AlertCircle} title="긴급 질문" count={urgentCount} defaultOpen={urgentCount > 0}>
          {urgentList.length === 0 ? <p className="text-[15px] text-slate-400 text-center py-4">수신된 질문이 없습니다</p> : <div className="space-y-3">
              {urgentList.map(q => <div key={q.id} className={`p-4 rounded-xl ${q.read ? 'bg-slate-50 dark:bg-slate-700/50 opacity-50' : 'bg-slate-50 dark:bg-slate-700'}`}>
                  <p className="text-[16px] text-slate-700 dark:text-slate-200 leading-relaxed">{q.text}</p>
                  <span className="text-[13px] text-slate-400 mt-2 block">익명</span>
                </div>)}
            </div>}
        </MobileSection>

        <MobileSection icon={HelpCircle} title="수업 질문" count={unansweredCount} defaultOpen={unansweredCount > 0}>
          {classQuestions.length === 0 ? <p className="text-[15px] text-slate-400 text-center py-4">학생 질문이 없습니다</p> : <div className="space-y-3">
              {classQuestions.slice(0, 10).map(q => <div key={q.id} className={`p-4 rounded-xl ${q.answered ? 'opacity-50' : 'bg-slate-50 dark:bg-slate-700'}`}>
                  <p className="text-[16px] text-slate-700 dark:text-slate-200 leading-relaxed">{q.text}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[13px] text-slate-400">{q.nickname}</span>
                    {q.answered && <span className="text-[13px] text-slate-400">답변 완료</span>}
                  </div>
                </div>)}
            </div>}
        </MobileSection>

        <MobileSection icon={Users} title={drawOnly ? '추첨 명단' : '참여자'} count={onlineList.length}>
          {onlineList.length === 0 ? <EmptyState title="아직 참여자가 없습니다" mascotSize="sm" mood="waiting" className="py-8" /> : <div className="divide-y divide-slate-50 dark:divide-slate-700">
              {onlineList.map(p => <div key={p.id} className="flex items-center gap-3.5 py-3.5">
                  <Avatar name={p.nickname} size="md" />
                  <div className="flex-1 min-w-0 leading-tight">
                    <span className="text-[16px] font-medium text-slate-700 dark:text-slate-200 block truncate">{p.nickname}</span>
                    {p.employeeId && p.employeeId !== p.nickname && <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">사번 {p.employeeId}</span>}
                  </div>
                </div>)}
            </div>}
        </MobileSection>

        {/* 추첨 전용 모드에는 입장할 학생이 없다 — 초대 링크 자리를 명단 관리가 대신한다. */}
        <div className="pt-1">
          {drawOnly ? <button onClick={() => setRosterOpen(true)} className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-slate-900 dark:bg-slate-100 text-[16px] font-medium text-white dark:text-slate-900 transition-colors duration-150 active:scale-[0.98]">
              <ListPlus size={18} />명단 관리
            </button> : <button onClick={handleCopy} className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-white dark:bg-slate-800 text-[16px] font-medium text-slate-700 dark:text-slate-200 transition-colors duration-150 active:scale-[0.98] active:bg-slate-50 dark:active:bg-slate-700">
              {copied ? <><Check size={18} className="text-emerald-500" />복사됨!</> : <><Copy size={18} className="text-slate-400" />초대 링크 복사</>}
            </button>}
        </div>

        <RosterModal open={rosterOpen} onClose={() => setRosterOpen(false)} sessionId={sessionId} participants={participants} />
      </div>
    </div>;
}
