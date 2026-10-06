import { useState, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useDialogLayer } from '@/hooks/useDialogLayer';
import { X, Send, CheckCircle2, Clipboard } from 'lucide-react';
import { formatChatTime } from '@/lib/utils';
import { useDMTyping } from '@/features/dm/api/useDMTyping';

const ChatMsg = memo(function ChatMsg({ msg, isOwn, currentUserName }) {
  if (msg.senderType === 'system') {
    return (
      <div className="flex justify-center my-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-700 max-w-[85%] text-center leading-snug">
          <Clipboard size={11} className="shrink-0 text-slate-500 dark:text-slate-400" />
          <span>{msg.text}</span>
        </div>
      </div>
    );
  }
  // 스태프 뷰에서 "본인 메시지 vs 다른 스태프 메시지" 구분 — 이름으로 판정.
  // senderType !== 'student'라도 sender가 본인 이름이 아니면 다른 스태프 → 왼쪽 버블에 이름 배지.
  const isOwnStaff = isOwn && (!currentUserName || msg.sender === currentUserName);

  if (isOwnStaff) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <div className="px-3.5 py-2.5 text-sm leading-relaxed bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 rounded-2xl rounded-br-sm max-w-[75%]">
          {msg.text}
        </div>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 px-1">{formatChatTime(msg.timestamp)}</span>
      </div>
    );
  }
  // 학생 메시지 또는 다른 스태프 메시지
  const isOtherStaff = isOwn && !isOwnStaff;
  return (
    <div className="flex flex-col items-start gap-0.5 max-w-[80%]">
      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 px-1 inline-flex items-center gap-1">
        {msg.sender}
        {isOtherStaff && (
          <span className="text-[9px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full">다른 스태프</span>
        )}
      </span>
      <div className={`px-3.5 py-2.5 text-sm leading-relaxed rounded-2xl rounded-tl-sm ${
        isOtherStaff
          ? 'bg-slate-50 dark:bg-slate-700/70 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600'
          : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
      }`}>
        {msg.text}
      </div>
      <span className="text-[10px] text-slate-500 dark:text-slate-400 px-1">{formatChatTime(msg.timestamp)}</span>
    </div>
  );
});

export default function StaffDMChat({
  dm, open, onClose, onResolve, onSendMessage, staffName, staffId, senderType,
  allActiveDMs, onSwitchDM, sessionId,
}) {
  const reducedMotion = useReducedMotion();
  const { dialogRef, trapFocus } = useDialogLayer(Boolean(open && dm), onClose);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const { activeTypers, notifyTyping, clearTyping } = useDMTyping(
    sessionId,
    dm?.id,
    { userId: staffId, userName: staffName }
  );

  useEffect(() => {
    if (open && dm) {
      messagesEndRef.current?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth' });
    }
    // length 증가에만 스크롤. dm 자체 변경은 의도적 무시
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dm?.messageList?.length, open, reducedMotion]);

  // 모달 닫을 때 타이핑 신호 정리
  useEffect(() => {
    if (!open) clearTyping();
  }, [open, clearTyping]);

  useEffect(() => {
    if (!open) return;
    // Dialog records its opener before the composer takes keyboard focus.
    const frame = requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  async function handleSend() {
    const text = inputText.trim();
    if (!text || !dm || sending) return;
    setSending(true);
    const ok = await onSendMessage(dm.id, text, staffName, senderType);
    if (ok) {
      setInputText('');
      clearTyping();
    }
    setSending(false);
  }

  async function handleResolve() {
    if (!dm) return;
    await onResolve(dm.id);
    onClose();
  }

  return (
    <AnimatePresence>
      {open && dm && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            ref={dialogRef} role="dialog" aria-modal="true" aria-label="1:1 도움 대화" tabIndex={-1} onKeyDown={trapFocus}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="mobile-conversation fixed inset-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[400px] sm:h-[520px] bg-white dark:bg-slate-800 sm:rounded-2xl sm:shadow-2xl z-50 flex flex-col overflow-hidden outline-none"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                  {(dm.studentName || '학').charAt(0)}
                </div>
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                  {dm.studentName || '학생'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleResolve}
                  className="inline-flex items-center gap-1 px-3 py-2 min-h-[40px] text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20 rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                >
                  <CheckCircle2 size={14} />
                  해결 완료
                </button>
                <button
                  onClick={onClose}
                  className="p-2 min-h-[40px] min-w-[40px] rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                  aria-label="닫기"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* DM list toggle (if multiple active DMs) */}
            {allActiveDMs?.length > 1 && (
              <div className="flex gap-1 px-4 py-2 border-b border-slate-50 dark:border-slate-700/50 overflow-x-auto scrollbar-hide shrink-0">
                {allActiveDMs.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => onSwitchDM(d)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors duration-150 shrink-0 ${
                      d.id === dm.id
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {d.studentName || '학생'}
                  </button>
                ))}
              </div>
            )}

            {/* 다른 스태프 타이핑 중 인디케이터 */}
            <AnimatePresence>
              {activeTypers.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-5 py-2 bg-slate-50 dark:bg-slate-700/60 border-b border-slate-200 dark:border-slate-600 overflow-hidden"
                >
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1.5">
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
                    <span className="truncate">
                      {activeTypers.map(t => t.name).join(', ')}님이 답변 작성 중
                    </span>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 scrollbar-hide">
              {dm.messageList?.map((msg) => (
                <ChatMsg
                  key={msg.id}
                  msg={msg}
                  isOwn={msg.senderType !== 'student'}
                  currentUserName={staffName}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-100 dark:border-slate-700 shrink-0">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => { setInputText(e.target.value); if (e.target.value) notifyTyping(); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                onBlur={() => inputText.trim() === '' && clearTyping()}
                placeholder="메시지를 입력하세요"
                aria-label="도움 응답 메시지"
                maxLength={500}
                className="flex-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-300 focus:outline-none focus:border-slate-400 focus:bg-white dark:focus:bg-slate-600 transition-colors duration-150"
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || sending}
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 disabled:opacity-30 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors duration-150 shrink-0"
                aria-label="보내기"
              >
                <Send size={16} />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
