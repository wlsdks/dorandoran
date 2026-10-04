import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { ref, set, push, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { getParticipantId, getNickname, getLastSeen, saveLastSeen } from '@/lib/participant';
import { useMyHandRaise } from '@/features/hand-raise/api/useHandRaises';
import { useStudentDM } from '@/features/dm/api/useStudentDM';
import { motion, AnimatePresence } from 'framer-motion';
import { Hand, MessageCircle, MessageSquare, HelpCircle, Headset, Send } from 'lucide-react';
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

      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
        role="toolbar"
        aria-label="참여 도구"
        className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200/70 dark:border-slate-700/50 z-30 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
      >
        <div className="max-w-[620px] mx-auto px-5 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          <div className="mb-2">
            <ReactionBar sessionId={sessionId} bubbleSessionId={sessionId} />
          </div>
          <div>
            <div className="grid grid-cols-5 gap-2">

              {/* 손들기 — raised state has pulsing ring + waving icon */}
              <motion.button
                whileTap={{ scale: 0.93 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                onClick={toggleHand}
                aria-pressed={isRaised}
                aria-label={isRaised ? '손 내리기' : '손들기'}
                className={isRaised ? BTN_ACTIVE : BTN_DEFAULT}
              >
                {/* 든 상태 표시는 BTN_ACTIVE 색으로 충분 — 무한 pulse ring은 산만해 제거,
                    손 흔들기 모션은 드는 순간 1회만 */}
                <motion.div
                  animate={isRaised
                    ? { rotate: [0, -18, 14, -10, 8, 0], y: [0, -2, 0] }
                    : { rotate: 0, y: 0 }}
                  transition={isRaised
                    ? { duration: 0.7, ease: 'easeInOut' }
                    : { type: 'spring', stiffness: 300, damping: 25 }}
                >
                  <Hand size={22} />
                </motion.div>
                <span className="text-xs max-[380px]:hidden">{isRaised ? '내리기' : '손들기'}</span>
              </motion.button>

              {/* 긴급 질문 */}
              <motion.button
                whileTap={{ scale: 0.93 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                onClick={() => setShowQuestionInput(true)}
                aria-label="강사에게 긴급 질문 보내기"
                className={BTN_DEFAULT}
              >
                <MessageCircle size={22} />
                <span className="text-xs max-[380px]:hidden">긴급질문</span>
              </motion.button>

              {/* 수업 질문 */}
              <motion.button
                whileTap={{ scale: 0.93 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                onClick={() => { setShowQA(true); setHasNewQuestion(false); }}
                aria-label="수업 질문"
                className={BTN_DEFAULT}
              >
                <HelpCircle size={22} />
                <span className="text-xs max-[380px]:hidden">질문</span>
                {hasNewQuestion && <span className={`${UNREAD_DOT} bg-red-500`} />}
              </motion.button>

              {/* 채팅 */}
              <motion.button
                whileTap={{ scale: 0.93 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                onClick={() => { setShowChat(true); setHasUnread(false); }}
                aria-label="채팅 열기"
                className={BTN_DEFAULT}
              >
                <MessageSquare size={22} />
                <span className="text-xs max-[380px]:hidden">채팅</span>
                {hasUnread && <span className={`${UNREAD_DOT} bg-red-500`} />}
              </motion.button>

              {/* 도움 요청 */}
              <motion.button
                whileTap={{ scale: 0.93 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                onClick={() => {
                  setShowDMChat(true);
                  setDmLastSeen(totalDMMessages);
                  saveLastSeen(sessionId, 'dm', totalDMMessages);
                }}
                aria-label="도움 요청"
                className={`${BTN_DEFAULT} ${allActiveDMs.length > 0 && dmUnread === 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
              >
                <Headset size={22} />
                <span className="text-xs max-[380px]:hidden">도움</span>
                {dmUnread > 0 && (
                  <span className={`${UNREAD_DOT} bg-red-500`} />
                )}
                {allActiveDMs.length > 0 && dmUnread === 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                )}
              </motion.button>

            </div>
          </div>
        </div>
      </motion.div>
    </>,
    document.body,
  );
});
