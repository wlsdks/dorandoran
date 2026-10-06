import { useState, useMemo, memo } from 'react';
import { ref, set } from 'firebase/database';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { Hand, Users, ChevronDown, AlertTriangle, Radio, MessageSquare, ArrowRight, Copy, Check } from 'lucide-react';
import { useHandRaises } from '@/features/hand-raise/api/useHandRaises';
import { useParticipants } from '@/features/participants/api/useParticipants';
import { useUrgentQuestions } from '@/features/questions/api/useUrgentQuestions';
import { useStaffDMs } from '@/features/dm/api/useStaffDMs';
import StaffDMChat from '@/features/dm/components/StaffDMChat';
import { QUESTION_TYPE_MAP } from '@/lib/question-types';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

function Accordion({ title, icon: Icon, count, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600 transition-colors duration-150"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
          <Icon size={14} className="text-slate-500 dark:text-slate-400" />
          {title}
          {count > 0 && (
            <motion.span
              key={count}
              initial={{ scale: 1.3 }}
              animate={{ scale: 1 }}
              className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[10px] font-bold"
            >
              {count}
            </motion.span>
          )}
        </span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={14} className="text-slate-500 dark:text-slate-400" />
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
            <div className="px-3.5 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CurrentQuestionStatus({ session }) {
  const currentQId = session?.currentQuestion;
  const questions = session?.questions;
  if (!currentQId || !questions?.[currentQId]) return null;

  const q = questions[currentQId];
  const typeInfo = QUESTION_TYPE_MAP[q.type];
  const typeLabel = typeInfo?.label || q.type;
  const voteCount = q.votes ? Object.keys(q.votes).length : 0;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Radio size={12} className="text-emerald-500 animate-pulse" />
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          진행 중인 질문
        </p>
      </div>
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
        {q.title}
      </p>
      <div className="flex items-center gap-2 mt-1.5">
        <Badge variant="primary">{typeLabel}</Badge>
        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{voteCount}명 응답</span>
      </div>
    </div>
  );
}

function UrgentQuestionSection({ sessionId }) {
  const { questionList, unreadCount } = useUrgentQuestions(sessionId);

  return (
    <Accordion title="긴급 질문" icon={AlertTriangle} count={unreadCount} defaultOpen={unreadCount > 0}>
      {questionList.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
          긴급 질문이 없습니다
        </p>
      ) : (
        <div className="space-y-1.5">
          {questionList.map((q) => (
            <div
              key={q.id}
              className={`p-2.5 rounded-lg text-sm ${
                q.read
                  ? 'bg-slate-50 dark:bg-slate-800 opacity-50'
                  : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600'
              }`}
            >
              <p className="text-slate-700 dark:text-slate-200 leading-relaxed">{q.text}</p>
              <span className="text-slate-500 dark:text-slate-400 text-xs mt-1 block">{q.anonymous === false && q.nickname ? q.nickname : '익명'}</span>
            </div>
          ))}
        </div>
      )}
    </Accordion>
  );
}

function HandRaiseSection({ sessionId }) {
  const { raisedList, count } = useHandRaises(sessionId);

  async function dismissOne(participantId) {
    try {
      await set(ref(db, `sessions/${sessionId}/handRaises/${participantId}/raised`), false);
    } catch (err) {
      logger.error('손들기 해제 실패:', err);
    }
  }

  return (
    <Accordion title="손들기" icon={Hand} count={count} defaultOpen>
      {count === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
          손든 학생이 없습니다
        </p>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {raisedList.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3"
              >
                <Avatar name={p.nickname} size="sm" />
                <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                  {p.nickname}
                </span>
                <Button variant="secondary" size="sm" onClick={() => dismissOne(p.id)}>
                  도움 완료
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </Accordion>
  );
}

const DMItem = memo(function DMItem({ dm, onOpen, onRespond }) {
  const lastMsg = dm.messageList?.[dm.messageList.length - 1];
  const preview = lastMsg?.text || '';
  const truncated = preview.length > 35 ? preview.slice(0, 35) + '...' : preview;
  const isWaiting = dm.status === 'waiting';

  return (
    <div
      onClick={() => onOpen(dm)}
      className="flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors duration-150"
    >
      <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-semibold text-slate-600 dark:text-slate-300 shrink-0">
        {(dm.studentName || '학').charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
            {dm.studentName || '학생'}
          </span>
          {isWaiting ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              대기
            </span>
          ) : (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-600 dark:text-slate-300 shrink-0">
              진행중
            </span>
          )}
        </div>
        {truncated && (
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{truncated}</p>
        )}
      </div>
      {isWaiting && (
        <button
          onClick={(e) => { e.stopPropagation(); onRespond(dm); }}
          className="inline-flex items-center gap-0.5 px-2 py-1 text-[11px] font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors duration-150 shrink-0"
        >
          응답
          <ArrowRight size={10} />
        </button>
      )}
    </div>
  );
});

function DMSection({ sessionId, staffId, staffName, senderType }) {
  const { waitingDMs, activeDMs, respondToDM, resolveDM, sendMessage } = useStaffDMs(sessionId);
  const [openDM, setOpenDM] = useState(null);

  const allDMs = useMemo(() => [...waitingDMs, ...activeDMs], [waitingDMs, activeDMs]);

  const liveDM = openDM ? (activeDMs.find((d) => d.id === openDM.id) || waitingDMs.find((d) => d.id === openDM.id) || openDM) : null;

  async function handleRespond(dm) {
    await respondToDM(dm.id, staffId, staffName);
    setOpenDM({ ...dm, status: 'active', staffName });
  }

  function handleOpen(dm) {
    if (dm.status === 'waiting') {
      handleRespond(dm);
    } else {
      setOpenDM(dm);
    }
  }

  return (
    <>
      <Accordion title="1:1 도움" icon={MessageSquare} count={allDMs.length} defaultOpen={waitingDMs.length > 0}>
        {allDMs.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
            도움 요청이 없습니다
          </p>
        ) : (
          <div className="space-y-0.5">
            {waitingDMs.map((dm) => (
              <DMItem key={dm.id} dm={dm} onOpen={handleOpen} onRespond={handleRespond} />
            ))}
            {activeDMs.map((dm) => (
              <DMItem key={dm.id} dm={dm} onOpen={handleOpen} onRespond={handleRespond} />
            ))}
          </div>
        )}
      </Accordion>

      <StaffDMChat
        dm={liveDM}
        open={!!liveDM}
        onClose={() => setOpenDM(null)}
        onResolve={resolveDM}
        onSendMessage={sendMessage}
        staffName={staffName}
        staffId={staffId}
        senderType={senderType || 'staff'}
        allActiveDMs={activeDMs}
        onSwitchDM={setOpenDM}
        sessionId={sessionId}
      />
    </>
  );
}

function ParticipantSection({ sessionId }) {
  const { onlineList } = useParticipants(sessionId);

  return (
    <Accordion title="참여자" icon={Users} count={onlineList.length} defaultOpen>
      {onlineList.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
          접속 중인 참여자가 없습니다
        </p>
      ) : (
        <div className="space-y-0.5">
          {onlineList.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-2 px-2 rounded-lg">
              <Avatar name={p.nickname} size="sm" />
              <span className="flex-1 text-sm text-slate-700 dark:text-slate-200 truncate">
                {p.nickname}
              </span>
            </div>
          ))}
        </div>
      )}
    </Accordion>
  );
}

function LinkSection({ sessionId }) {
  const [copied, setCopied] = useState(false);
  const studentUrl = `${window.location.origin}/?s=${sessionId}`;
  const liveUrl = `${window.location.origin}/live?s=${sessionId}`;

  function handleCopy(url) {
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-1.5 px-1">
      <button onClick={() => handleCopy(studentUrl)}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-150 active:scale-[0.97]">
        {copied ? <><Check size={12} className="text-emerald-500" />복사됨</> : <><Copy size={12} />초대 링크 복사</>}
      </button>
      <button onClick={() => handleCopy(liveUrl)}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-150 active:scale-[0.97]">
        <Radio size={12} />전자칠판 링크 복사
      </button>
    </div>
  );
}

export default memo(function StaffRightPanel({ sessionId, session, staffId, staffName, senderType }) {
  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <DMSection sessionId={sessionId} staffId={staffId} staffName={staffName} senderType={senderType} />
      <CurrentQuestionStatus session={session} />
      <UrgentQuestionSection sessionId={sessionId} />
      <HandRaiseSection sessionId={sessionId} />
      <ParticipantSection sessionId={sessionId} />
      <LinkSection sessionId={sessionId} />
    </div>
  );
});
