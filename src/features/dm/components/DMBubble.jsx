import { useState, useEffect, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, X, Plus, ArrowLeft, Headset, CheckCircle2, Clipboard } from 'lucide-react';
import { formatChatTime } from '@/lib/utils';
import Button from '@/components/ui/Button';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import { useDMTyping } from '@/features/dm/api/useDMTyping';

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
 * Student DM modal — always opens from "도움" button.
 * Two tabs: [채팅방 목록 | 새 도움 요청]
 */
export default function DMBubble({ activeDMs, activeDM, senderName, onSendMessage, onClose, onRequestHelp, sessionId, participantId }) {
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

  // 패널 열릴 때 배경 스크롤 잠금
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Esc로 모달 닫기
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const rawDMs = activeDMs || (activeDM ? [activeDM] : []);
  const resolvedCount = rawDMs.filter((d) => d.status === 'resolved').length;
  const allDMs = showResolved ? rawDMs : rawDMs.filter((d) => d.status !== 'resolved');
  const currentDM = selectedDM ? rawDMs.find((d) => d.id === selectedDM.id) || selectedDM : null;

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
  const TAB_CLS = (active) => `flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors duration-150 ${
    active ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
  }`;

  const content = (
    <>
      <motion.div key="dm-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" onClick={onClose} />
      <motion.div key="dm-panel" initial={{ opacity: 0, y: '100%' }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="mobile-conversation fixed inset-x-0 bottom-0 top-[10vh] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[400px] sm:h-[520px] bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl sm:shadow-2xl z-50 flex flex-col overflow-hidden">

        {/* Drag handle (mobile only) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-600" />
        </div>
        {currentDM ? (
          <>
            {/* Chat view */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <button onClick={() => setSelectedDM(null)}
                  className="w-12 h-12 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-150 shrink-0"
                  aria-label="목록으로"><ArrowLeft size={16} /></button>
                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
                  {isWaiting ? '도움 요청' : currentDM.staffName || '스태프'}
                </span>
                {!isWaiting && (
                  <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full shrink-0">스태프</span>
                )}
                {isResolved && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />해결됨</span>}
                {isWaiting && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 shrink-0">대기중</span>}
              </div>
              <button onClick={onClose} className="w-12 h-12 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-150" aria-label="닫기"><X size={16} /></button>
            </div>
            <AnimatePresence>
              {activeTypers.length > 0 && !isResolved && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-5 py-2 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 overflow-hidden"
                >
                  <p className="text-[12px] text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1.5">
                    <span className="flex gap-0.5">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="w-1 h-1 rounded-full bg-slate-500 dark:bg-slate-400"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                        />
                      ))}
                    </span>
                    <span className="truncate">{activeTypers[0].name}님이 답변 작성 중</span>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 scrollbar-hide">
              {isWaiting && (
                <div className="text-center py-6">
                  <p className="text-sm text-slate-400 dark:text-slate-500">스태프를 기다리는 중</p>
                  <div className="flex justify-center gap-1 mt-2">
                    {[0, 1, 2].map((i) => (
                      <motion.span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-500"
                        animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
                    ))}
                  </div>
                </div>
              )}
              {currentDM.messageList?.map((msg) => <DMMessage key={msg.id} msg={msg} isOwn={msg.senderType === 'student'} />)}
              <div ref={messagesEndRef} />
            </div>
            {isResolved ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="flex flex-col items-center gap-1.5 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:py-3 border-t border-slate-100 dark:border-slate-700 shrink-0"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-500 dark:text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">도움이 완료되었습니다</span>
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500">새로운 도움이 필요하면 다시 요청해주세요</span>
              </motion.div>
            ) : (
              <>
                {sendError && (
                  <p className="px-4 pt-2 text-xs text-red-500 dark:text-red-400 border-t border-slate-100 dark:border-slate-700 shrink-0">{sendError}</p>
                )}
                <div className="flex items-center gap-2 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:py-3 border-t border-slate-100 dark:border-slate-700 shrink-0">
                  <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="메시지를 입력하세요" aria-label="도움 요청 메시지" maxLength={200} autoFocus
                    className="flex-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white dark:focus:bg-slate-600 transition-colors duration-150" />
                  <button onClick={handleSend} disabled={!inputText.trim() || sending}
                    className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 disabled:opacity-30 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors duration-150 shrink-0"
                    aria-label="보내기"><Send size={16} /></button>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            {/* Header with tabs */}
            <div className="px-5 pt-4 pb-0 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">도움</span>
                <button onClick={onClose} className="w-12 h-12 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-150" aria-label="닫기"><X size={16} /></button>
              </div>
              <div className="flex gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                <button onClick={() => setTab('list')} className={TAB_CLS(tab === 'list')}>
                  <MessageSquare size={12} className="inline mr-1" />채팅방 {allDMs.length > 0 && `(${allDMs.length})`}
                </button>
                <button onClick={() => setTab('new')} className={TAB_CLS(tab === 'new')}>
                  <Plus size={12} className="inline mr-1" />새 도움 요청
                </button>
              </div>
            </div>

            {tab === 'list' ? (
              <div className="flex-1 overflow-y-auto px-3 py-3 scrollbar-hide">
                {allDMs.length === 0 ? (
                  resolvedCount > 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 py-12">
                      <p className="text-sm text-slate-400 dark:text-slate-500">진행 중인 대화가 없습니다</p>
                      <button
                        onClick={() => setShowResolved(true)}
                        className="text-xs text-slate-500 dark:text-slate-400 underline decoration-dotted underline-offset-4"
                      >
                        해결된 대화 {resolvedCount}개 보기
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-4 py-12">
                      <DoranDoranMascot size="sm" mood="waiting" />
                      <p className="text-[15px] text-slate-400 dark:text-slate-500 text-center">도움 요청 내역이 없습니다</p>
                      <motion.button whileTap={{ scale: 0.96 }} onClick={() => setTab('new')}
                        className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium transition-colors duration-150">
                        새 도움 요청하기
                      </motion.button>
                    </div>
                  )
                ) : (
                  <>
                    {allDMs.map((dm) => <DMListItem key={dm.id} dm={dm} onClick={() => setSelectedDM(dm)} />)}
                    {resolvedCount > 0 && (
                      <div className="flex justify-center pt-3 pb-1">
                        <button
                          onClick={() => setShowResolved((v) => !v)}
                          className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline decoration-dotted underline-offset-4"
                        >
                          {showResolved ? '해결된 대화 숨기기' : `해결된 대화 ${resolvedCount}개 보기`}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 scrollbar-hide">
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
                  <form onSubmit={handleRequestSubmit} className="space-y-4">
                    <div className="text-center space-y-1">
                      <Headset size={24} className="text-slate-900 dark:text-slate-100 mx-auto mb-2" />
                      <p className="text-slate-900 dark:text-slate-100 font-bold text-lg tracking-tight">도움 요청</p>
                      <p className="text-slate-400 dark:text-slate-500 text-xs">스태프에게 1:1 도움을 요청합니다</p>
                    </div>
                    <textarea value={requestText} onChange={(e) => setRequestText(e.target.value)}
                      placeholder="어떤 도움이 필요하신가요?" aria-label="도움 요청 내용" maxLength={200} rows={3} autoFocus
                      className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-colors duration-150" />
                    {requestError && (
                      <p className="text-xs text-red-500 dark:text-red-400">{requestError}</p>
                    )}
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
      </motion.div>
    </>
  );

  return createPortal(content, document.body);
}
