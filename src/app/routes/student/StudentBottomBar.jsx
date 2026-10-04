import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { ref, set, push, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { getParticipantId, getNickname, getLastSeen, saveLastSeen } from '@/lib/participant';
import { useMyHandRaise } from '@/features/hand-raise/api/useHandRaises';
import { useStudentDM } from '@/features/dm/api/useStudentDM';
import { motion } from 'framer-motion';
import { Hand, MessageCircle, MessageSquare, HelpCircle, Headset, Send, MoreHorizontal, Smile, X, ChevronDown } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import ReactionBar from '@/features/reactions/components/ReactionBar';
import ReactionOverlay from '@/features/reactions/components/ReactionOverlay';
import ChatPanel from '@/features/chat/components/ChatPanel';
import ClassQAPanel from '@/features/class-questions/components/ClassQAPanel';
import DMBubble from '@/features/dm/components/DMBubble';
import StudentToasts from '@/app/routes/student/StudentToasts';
import { timing } from '@/lib/design-tokens';

const UNREAD_DOT = 'absolute top-1 right-1 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-800';

// Base button style — 48px+ touch target, consistent look
const BTN_BASE = 'h-[56px] w-full rounded-xl font-medium text-sm flex flex-col items-center justify-center gap-0.5 transition-colors duration-150 relative active:scale-[0.96]';
const BTN_DEFAULT = `${BTN_BASE} bg-slate-50 text-slate-600 hover:bg-slate-100 active:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:active:bg-slate-600`;
const BTN_ACTIVE = `${BTN_BASE} bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900`;

export default memo(function StudentBottomBar({ sessionId }) {
  const [showMore, setShowMore] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showQuestionInput, setShowQuestionInput] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showQA, setShowQA] = useState(false);
  const [showDMChat, setShowDMChat] = useState(false);
  const [dmLastSeen, setDmLastSeen] = useState(() => getLastSeen(sessionId, 'dm') >= 0 ? getLastSeen(sessionId, 'dm') : 0);
  const [hasUnread, setHasUnread] = useState(false);
  const [hasNewQuestion, setHasNewQuestion] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const { raised: isRaised } = useMyHandRaise(sessionId);

  const pid = getParticipantId();
  const nickname = getNickname() || '익명';
  const {
    activeDM, allActiveDMs, sendMessage: sendDMMessage, requestHelp,
    newlyResolved, clearNewlyResolved,
    newStaffMessage, clearNewStaffMessage,
  } = useStudentDM(sessionId, pid);
  const [dmResolved, setDmResolved] = useState(null);
  const [staffReplied, setStaffReplied] = useState(null);

  // Show toast when DM gets resolved
  useEffect(() => {
    if (newlyResolved) {
      setDmResolved(newlyResolved.staffName);
      clearNewlyResolved();
      const t = setTimeout(() => setDmResolved(null), 3000);
      return () => clearTimeout(t);
    }
  }, [newlyResolved, clearNewlyResolved]);

  // Show toast when staff replies (특히 학생이 먼저 요청 안 했는데 스태프가 먼저 1:1 답변 시작한 경우)
  useEffect(() => {
    if (!newStaffMessage) return;
    // DM 버블이 이미 열려있으면 토스트 불필요
    if (showDMChat) {
      clearNewStaffMessage();
      return;
    }
    setStaffReplied(newStaffMessage);
    clearNewStaffMessage();
    const t = setTimeout(() => setStaffReplied(null), 4500);
    return () => clearTimeout(t);
  }, [newStaffMessage, clearNewStaffMessage, showDMChat]);
  const [handAcknowledged, setHandAcknowledged] = useState(false);
  const wasRaisedRef = useRef(false);
  const selfToggledRef = useRef(false);

  // Detect instructor dismissal (not self-toggle)
  useEffect(() => {
    if (wasRaisedRef.current && !isRaised && !selfToggledRef.current) {
      setHandAcknowledged(true);
      const t = setTimeout(() => setHandAcknowledged(false), 3000);
      wasRaisedRef.current = false;
      return () => clearTimeout(t);
    }
    wasRaisedRef.current = isRaised;
    selfToggledRef.current = false;
  }, [isRaised]);

  const totalDMMessages = allActiveDMs.reduce((sum, dm) => sum + (dm.messageList?.length || 0), 0);
  const dmUnread = Math.max(0, totalDMMessages - dmLastSeen);

  const handleNewMessage = useCallback(() => setHasUnread(true), []);
  const handleNewQuestion = useCallback(() => setHasNewQuestion(true), []);
  const handleHelpRequest = useCallback(async (text) => requestHelp(text, nickname), [requestHelp, nickname]);

  async function toggleHand() {
    try {
      selfToggledRef.current = true;
      const handRef = ref(db, `sessions/${sessionId}/handRaises/${pid}`);
      await set(handRef, isRaised
        ? { nickname: getNickname(), raised: false, raisedAt: null }
        : { nickname: getNickname(), raised: true, raisedAt: serverTimestamp() }
      );
    } catch (err) { logger.error('Toggle hand failed:', err); }
  }

  async function submitUrgentQuestion(e) {
    e.preventDefault();
    if (!questionText.trim()) return;
    setSubmitError(null);
    try {
      await push(ref(db, `sessions/${sessionId}/urgentQuestions`), { participantId: getParticipantId(), text: questionText.trim(), nickname: isAnonymous ? null : nickname, anonymous: isAnonymous, timestamp: serverTimestamp(), read: false });
      setQuestionText('');
      setShowQuestionInput(false);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), timing.successToastDuration);
    } catch (err) {
      logger.error('Submit question failed:', err);
      setSubmitError('전송에 실패했습니다. 다시 시도해주세요.');
      setTimeout(() => setSubmitError(null), 3000);
    }
  }

  return createPortal(
    <>
      <ReactionOverlay sessionId={sessionId} />
      <ChatPanel sessionId={sessionId} senderName={nickname} senderType="student" open={showChat} onClose={() => setShowChat(false)} onNewMessage={handleNewMessage} />
      <ClassQAPanel sessionId={sessionId} open={showQA} onClose={() => setShowQA(false)} onNewQuestion={handleNewQuestion} />
      {showDMChat && (
        <DMBubble
          activeDMs={allActiveDMs}
          activeDM={activeDM}
          senderName={nickname}
          onSendMessage={sendDMMessage}
          onClose={() => setShowDMChat(false)}
          onRequestHelp={handleHelpRequest}
          sessionId={sessionId}
          participantId={pid}
        />
      )}

      <Modal open={showQuestionInput} onClose={() => setShowQuestionInput(false)} ariaLabel="긴급 질문">
        <form onSubmit={submitUrgentQuestion} className="space-y-5">
          <div className="text-center space-y-1">
            <MessageCircle size={24} className="text-slate-900 dark:text-slate-100 mx-auto mb-2" />
            <p className="text-slate-900 dark:text-slate-100 font-bold text-lg tracking-tight">긴급 질문</p>
          </div>
          <button type="button" onClick={() => setIsAnonymous(prev => !prev)} className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-slate-50 dark:bg-slate-700 transition-colors duration-150 active:scale-[0.98]">
            <span className="text-sm text-slate-600 dark:text-slate-300">익명으로 보내기</span>
            <span className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${isAnonymous ? 'bg-slate-900 dark:bg-slate-100' : 'bg-slate-200 dark:bg-slate-600'}`}>
              <span className={`inline-block h-5 w-5 rounded-full bg-white dark:bg-slate-900 shadow-sm transform transition-transform duration-200 mt-0.5 ${isAnonymous ? 'translate-x-5.5 ml-0.5' : 'translate-x-0.5'}`} />
            </span>
          </button>
          {!isAnonymous && <p className="text-center text-slate-400 text-sm -mt-2">{nickname} (으)로 표시됩니다</p>}
          {isAnonymous && <p className="text-center text-slate-400 text-sm -mt-2">이름이 표시되지 않습니다</p>}
          <textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="질문을 입력하세요..." aria-label="긴급 질문 내용" maxLength={200} rows={3} className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3.5 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-colors duration-150" autoFocus />
          <Button type="submit" variant="primary" size="lg" disabled={!questionText.trim()} className="w-full"><Send size={16} />보내기</Button>
        </form>
      </Modal>

      <StudentToasts
        submitted={submitted}
        submitError={submitError}
        dmResolved={dmResolved}
        handAcknowledged={handAcknowledged}
        staffReplied={staffReplied}
        onOpenDM={() => { setStaffReplied(null); setShowDMChat(true); }}
      />

      <Modal open={showMore} onClose={() => setShowMore(false)} ariaLabel="참여 도구 더보기">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">참여 도구</h2>
            <button type="button" onClick={() => setShowMore(false)} aria-label="더보기 닫기" className="h-12 w-12 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"><X size={20} /></button>
          </div>
          <button type="button" onClick={() => { setShowMore(false); setShowChat(true); setHasUnread(false); }} className="w-full min-h-16 flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-700 px-4 py-3 text-left">
            <MessageSquare size={24} className="shrink-0 text-slate-600 dark:text-slate-300" />
            <span className="flex-1"><span className="block font-semibold text-slate-900 dark:text-slate-100">채팅 {hasUnread && <span className="text-indigo-500 text-sm">새 메시지</span>}</span><span className="block text-sm text-slate-500 dark:text-slate-300">강사와 학습자 모두에게 보내요</span></span>
          </button>
          <button type="button" onClick={() => { setShowMore(false); setShowDMChat(true); setDmLastSeen(totalDMMessages); saveLastSeen(sessionId, 'dm', totalDMMessages); }} className="w-full min-h-16 flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-700 px-4 py-3 text-left">
            <Headset size={24} className="shrink-0 text-slate-600 dark:text-slate-300" />
            <span className="flex-1"><span className="block font-semibold text-slate-900 dark:text-slate-100">1:1 도움 {dmUnread > 0 && <span className="text-indigo-500 text-sm">새 답변</span>}</span><span className="block text-sm text-slate-500 dark:text-slate-300">스태프에게 개인적으로 도움을 받아요</span></span>
          </button>
          <button type="button" onClick={() => { setShowMore(false); setShowQuestionInput(true); }} className="w-full min-h-16 flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-700 px-4 py-3 text-left">
            <MessageCircle size={24} className="shrink-0 text-slate-600 dark:text-slate-300" />
            <span className="flex-1"><span className="block font-semibold text-slate-900 dark:text-slate-100">긴급 질문</span><span className="block text-sm text-slate-500 dark:text-slate-300">수업 중 바로 확인이 필요할 때 보내요</span></span>
          </button>
          <button type="button" onClick={() => setShowReactions(value => !value)} aria-expanded={showReactions} aria-controls="student-reaction-tools" className="w-full min-h-14 flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-700 px-4 py-3 text-left font-semibold text-slate-900 dark:text-slate-100">
            <Smile size={24} className="shrink-0 text-slate-600 dark:text-slate-300" /><span className="flex-1">반응 보내기</span><ChevronDown size={18} className={showReactions ? 'rotate-180' : ''} />
          </button>
          {showReactions && <div id="student-reaction-tools" className="pt-1 [&>div>div:last-child]:flex-wrap"><ReactionBar sessionId={sessionId} bubbleSessionId={sessionId} /></div>}
        </div>
      </Modal>

      <motion.div
        initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        role="toolbar" aria-label="참여 도구"
        className="mobile-learning-tools fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200/70 dark:border-slate-700/50 z-30 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
      >
        <div className="max-w-[620px] mx-auto px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-3 gap-2">
            <motion.button whileTap={{ scale: 0.96 }} onClick={toggleHand} aria-pressed={isRaised} aria-label={isRaised ? '손 내리기' : '손들기'} className={isRaised ? BTN_ACTIVE : BTN_DEFAULT}>
              <motion.div animate={isRaised ? { rotate: [0, -18, 14, -10, 8, 0] } : { rotate: 0 }} transition={{ duration: 0.7, ease: 'easeInOut' }}><Hand size={22} /></motion.div>
              <span className="text-sm">{isRaised ? '손 내리기' : '손들기'}</span>
            </motion.button>
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => { setShowQA(true); setHasNewQuestion(false); }} aria-label="수업 질문" className={BTN_DEFAULT}>
              <HelpCircle size={22} /><span className="text-sm">질문</span>
              {hasNewQuestion && <span className={`${UNREAD_DOT} bg-red-500`} />}
            </motion.button>
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowMore(true)} aria-label="참여 도구 더보기" aria-haspopup="dialog" className={BTN_DEFAULT}>
              <MoreHorizontal size={22} /><span className="text-sm">더보기</span>
              {(hasUnread || dmUnread > 0) && <span className={`${UNREAD_DOT} bg-red-500`} />}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </>,
    document.body,
  );
});
