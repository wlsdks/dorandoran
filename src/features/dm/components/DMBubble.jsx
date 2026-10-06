import { useState, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, Plus, ArrowLeft, Headset, CheckCircle2, Clipboard } from 'lucide-react';
import { formatChatTime } from '@/lib/utils';
import Button from '@/components/ui/Button';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import { useDMTyping } from '@/features/dm/api/useDMTyping';
import BottomSheet from '@/components/ui/BottomSheet';

const DMMessage = memo(function DMMessage({ msg, isOwn }) {
  if (msg.senderType === 'system') {
    return (
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center my-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-700 max-w-[85%] text-center leading-snug">
          <Clipboard size={11} className="shrink-0 text-slate-400" />
          <span>{msg.text}</span>
        </div>
      </motion.div>
    );
  }
  return (
    <motion.div initial={{ opacity: 0, x: isOwn ? 8 : -8 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} gap-0.5`}>
      {!isOwn && (
        <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400 px-1">
          {msg.sender}
          {msg.senderType === 'staff' && (
            <span className="ml-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-600 px-1.5 py-0.5 rounded-full">스태프</span>
          )}
        </span>
      )}
      <div className={`inline-block px-4 py-2.5 text-[15px] leading-relaxed rounded-2xl max-w-[80%] ${
        isOwn
          ? 'bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 rounded-br-sm'
          : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-sm'
      }`}>
        {msg.text}
      </div>
      <span className="text-[11px] text-slate-300 dark:text-slate-500 px-1">{formatChatTime(msg.timestamp)}</span>
    </motion.div>
  );
});

const DMListItem = memo(function DMListItem({ dm, onClick }) {
  const lastMsg = dm.messageList?.[dm.messageList.length - 1];
  const isWaiting = dm.status === 'waiting';
  return (
    <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="w-full flex items-center gap-3.5 p-3.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors duration-150 text-left">
      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300 shrink-0">
        {(dm.staffName || '스').charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {isWaiting ? '도움 요청' : dm.staffName || '스태프'}
          </span>
          {!isWaiting && (
            <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full shrink-0">스태프</span>
          )}
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold shrink-0 ${
            dm.status === 'resolved' ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              : isWaiting ? 'bg-slate-50 text-slate-400 dark:bg-slate-700 dark:text-slate-500'
              : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
          }`}>
            {dm.status === 'resolved' && <span className="w-1 h-1 rounded-full bg-emerald-500" />}
            {dm.status === 'resolved' ? '해결됨' : isWaiting ? '대기중' : '진행중'}
          </span>
        </div>
        {lastMsg && <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-1 leading-relaxed">{lastMsg.text}</p>}
      </div>
    </motion.button>
  );
});

/**
 * Student DM sheet — always opens from "1:1 도움".
 * Two tabs: [채팅방 목록 | 새 도움 요청]. The thread view puts its back button in the sheet header.
 */
export default function DMBubble({ open = true, activeDMs, activeDM, senderName, onSendMessage, onClose, onRequestHelp, sessionId, participantId }) {
  const [tab, setTab] = useState('list'); // 'list' | 'new'
  const [selectedDM, setSelectedDM] = useState(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [requestText, setRequestText] = useState('');
  const [requestSending, setRequestSending] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [sendError, setSendError] = useState('');
  const [requestError, setRequestError] = useState('');
  const messagesEndRef = useRef(null);

  const rawDMs = activeDMs || (activeDM ? [activeDM] : []);
  const resolvedCount = rawDMs.filter((d) => d.status === 'resolved').length;
  const allDMs = showResolved ? rawDMs : rawDMs.filter((d) => d.status !== 'resolved');
  const currentDM = open && selectedDM ? rawDMs.find((d) => d.id === selectedDM.id) || selectedDM : null;

  // 학생은 타이핑 신호 송신 안 함 — 읽기 전용으로 "스태프가 답변 작성 중" 표시.
  const { activeTypers } = useDMTyping(sessionId, currentDM?.id, { userId: participantId });

  useEffect(() => {
    if (currentDM) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    // 새 메시지 추가(length 증가)에만 스크롤. currentDM 자체 변경(다른 DM 전환)은 의도적 무시
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDM?.messageList?.length]);

  async function handleSend() {
    const text = inputText.trim();
    if (!text || sending || !currentDM) return;
    setSending(true);
    setSendError('');
    const ok = await onSendMessage(text, senderName);
    if (ok) setInputText('');
    else setSendError('전송에 실패했습니다. 다시 시도해주세요.');
    setSending(false);
  }

  async function handleRequestSubmit(e) {
    e.preventDefault();
    if (!requestText.trim() || requestSending) return;
    setRequestSending(true);
    setRequestError('');
    const ok = await onRequestHelp(requestText.trim());
    setRequestSending(false);
    if (ok) {
      setRequestText('');
      setRequestSent(true);
      setTimeout(() => { setRequestSent(false); setTab('list'); }, 1500);
    } else {
      setRequestError('도움 요청에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  }

  const isWaiting = currentDM?.status === 'waiting';
  const isResolved = currentDM?.status === 'resolved';
  const TAB_CLS = (active) => `flex-1 min-h-11 py-2.5 text-sm font-semibold rounded-lg transition-colors duration-150 ${
    active ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'
  }`;
  const statusChip = (label, dot) => <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 shrink-0">{dot && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}{label}</span>;

  const threadTitle = currentDM && (
    <div className="flex items-center gap-1 min-w-0">
      <button type="button" onClick={() => setSelectedDM(null)} aria-label="목록으로"
        className="-ml-2 w-12 h-12 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 active:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700 dark:active:bg-slate-600 transition-colors duration-100 shrink-0"><ArrowLeft size={20} /></button>
      <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">{isWaiting ? '도움 요청' : currentDM.staffName || '스태프'}</h2>
      {isResolved && statusChip('해결됨', true)}
      {isWaiting && statusChip('대기중')}
    </div>
  );

  return (
    <BottomSheet open={open} onClose={onClose} variant="full" title={currentDM ? threadTitle : '1:1 도움'} ariaLabel="도움">
      {currentDM ? (
        <>
          <AnimatePresence>
            {activeTypers.length > 0 && !isResolved && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="px-5 py-2 bg-slate-50 dark:bg-slate-700/50 border-y border-slate-100 dark:border-slate-700 overflow-hidden shrink-0">
                <p className="text-[12px] text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1.5">
                  <span className="flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <motion.span key={i} className="w-1 h-1 rounded-full bg-slate-500 dark:bg-slate-400" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
                    ))}
                  </span>
                  <span className="truncate">{activeTypers[0].name}님이 답변 작성 중</span>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 flex flex-col gap-3 scrollbar-hide border-t border-slate-100 dark:border-slate-700">
            {isWaiting && (
              <div className="text-center py-6">
                <p className="text-sm text-slate-400 dark:text-slate-500">스태프를 기다리는 중</p>
                <div className="flex justify-center gap-1 mt-2">
                  {[0, 1, 2].map((i) => (
                    <motion.span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-500" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
                  ))}
                </div>
              </div>
            )}
            {currentDM.messageList?.map((msg) => <DMMessage key={msg.id} msg={msg} isOwn={msg.senderType === 'student'} />)}
            <div ref={messagesEndRef} />
          </div>
          {isResolved ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="flex flex-col items-center gap-1.5 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3 border-t border-slate-100 dark:border-slate-700 shrink-0">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500 dark:text-emerald-400" />
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">도움이 완료되었습니다</span>
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500">새로운 도움이 필요하면 다시 요청해주세요</span>
            </motion.div>
          ) : (
            <>
              {sendError && <p className="px-4 pt-2 text-xs text-red-500 dark:text-red-400 border-t border-slate-100 dark:border-slate-700 shrink-0">{sendError}</p>}
              <div className="flex items-center gap-2 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3 border-t border-slate-100 dark:border-slate-700 shrink-0">
                <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="메시지를 입력하세요" aria-label="도움 요청 메시지" maxLength={200} autoFocus enterKeyHint="send"
                  className="flex-1 min-w-0 min-h-12 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white dark:focus:bg-slate-600 transition-colors duration-150" />
                <button onClick={handleSend} disabled={!inputText.trim() || sending}
                  className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 disabled:opacity-30 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors duration-150 shrink-0"
                  aria-label="보내기"><Send size={16} /></button>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="px-4 pt-1 pb-3 shrink-0">
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-700/50 rounded-xl p-1" role="tablist" aria-label="도움 보기">
              <button role="tab" aria-selected={tab === 'list'} onClick={() => setTab('list')} className={TAB_CLS(tab === 'list')}>
                <MessageSquare size={12} className="inline mr-1" />채팅방 {allDMs.length > 0 && `(${allDMs.length})`}
              </button>
              <button role="tab" aria-selected={tab === 'new'} onClick={() => setTab('new')} className={TAB_CLS(tab === 'new')}>
                <Plus size={12} className="inline mr-1" />새 도움 요청
              </button>
            </div>
          </div>

          {tab === 'list' ? (
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3 scrollbar-hide">
              {allDMs.length === 0 ? (
                resolvedCount > 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 py-12">
                    <p className="text-sm text-slate-400 dark:text-slate-500">진행 중인 대화가 없습니다</p>
                    <button onClick={() => setShowResolved(true)} className="min-h-11 px-3 text-sm text-slate-500 dark:text-slate-400 underline decoration-dotted underline-offset-4">
                      해결된 대화 {resolvedCount}개 보기
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-4 py-12">
                    <DoranDoranMascot size="sm" mood="waiting" />
                    <p className="text-[15px] text-slate-400 dark:text-slate-500 text-center">도움 요청 내역이 없습니다</p>
                    <motion.button whileTap={{ scale: 0.96 }} onClick={() => setTab('new')}
                      className="min-h-12 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium transition-colors duration-150">
                      새 도움 요청하기
                    </motion.button>
                  </div>
                )
              ) : (
                <>
                  {allDMs.map((dm) => <DMListItem key={dm.id} dm={dm} onClick={() => setSelectedDM(dm)} />)}
                  {resolvedCount > 0 && (
                    <div className="flex justify-center pt-3 pb-1">
                      <button onClick={() => setShowResolved((v) => !v)} className="min-h-11 px-3 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline decoration-dotted underline-offset-4">
                        {showResolved ? '해결된 대화 숨기기' : `해결된 대화 ${resolvedCount}개 보기`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="dm-request-body flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] scrollbar-hide">
              {requestSent ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Headset size={20} className="text-emerald-600 dark:text-emerald-400" />
                  </motion.div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">도움 요청 전송됨</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">스태프가 곧 응답합니다</p>
                </div>
              ) : (
                <form onSubmit={handleRequestSubmit} className="dm-request-form space-y-4">
                  <div className="dm-request-intro space-y-1">
                    <p className="text-slate-900 dark:text-slate-100 font-bold text-lg tracking-tight">도움 요청</p>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">스태프에게 1:1로 도움을 요청해요</p>
                  </div>
                  <textarea value={requestText} onChange={(e) => setRequestText(e.target.value)}
                    placeholder="어떤 도움이 필요하신가요?" aria-label="도움 요청 내용" maxLength={200} rows={3} autoFocus
                    className="dm-request-textarea w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-colors duration-150" />
                  {requestError && <p className="text-xs text-red-500 dark:text-red-400">{requestError}</p>}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 tabular-nums">{requestText.length}/200</span>
                    <Button type="submit" variant="primary" size="md" disabled={!requestText.trim() || requestSending}>
                      <Send size={16} />보내기
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </>
      )}
    </BottomSheet>
  );
}
