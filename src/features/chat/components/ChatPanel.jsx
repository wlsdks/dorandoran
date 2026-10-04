import { useState, useEffect, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, MessageCircle, Shield } from 'lucide-react';
import { hapticTap } from '@/lib/haptics';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import { useChat } from '@/features/chat/api/useChat';
import { useStaffChat } from '@/features/dm/api/useStaffChat';
import { getLastSeen, saveLastSeen } from '@/lib/participant';
import ChatMessage from '@/features/chat/components/ChatMessage';

const MAX_LENGTH = 500;

export default memo(function ChatPanel({ sessionId, senderName, senderType, open, onClose, onNewMessage, inline = false }) {
  const isStaffOrInstructor = senderType === 'staff' || senderType === 'instructor';
  const [channel, setChannel] = useState('public');

  // 패널 열릴 때 배경 스크롤 잠금
  useEffect(() => {
    if (!open || inline) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open, inline]);

  const publicChat = useChat(sessionId);
  // Only subscribe to staffChat for staff/instructor — students skip the Firebase listener entirely
  const staffChat = useStaffChat(sessionId, { enabled: isStaffOrInstructor });
  const activeChat = channel === 'staff' ? staffChat : publicChat;
  const { messages, sendMessage, loading, canSend } = activeChat;

  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [staffUnread, setStaffUnread] = useState(false);
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const prevPublicCountRef = useRef(getLastSeen(sessionId, 'chat'));
  const prevStaffCountRef = useRef(getLastSeen(sessionId, 'staffchat'));
  const isNearBottomRef = useRef(true);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }

  useEffect(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: messages.length <= 1 ? 'instant' : 'smooth' });
    }
  }, [messages.length]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'instant' }); isNearBottomRef.current = true; }, 100);
      return () => clearTimeout(t);
    }
  }, [open, channel]);

  useEffect(() => {
    if (publicChat.loading) return;
    if (prevPublicCountRef.current >= 0 && publicChat.messages.length > prevPublicCountRef.current && !open && onNewMessage) onNewMessage();
    prevPublicCountRef.current = publicChat.messages.length;
    if (open) saveLastSeen(sessionId, 'chat', publicChat.messages.length);
  }, [publicChat.messages.length, publicChat.loading, open, onNewMessage, sessionId]);

  useEffect(() => {
    if (!isStaffOrInstructor || staffChat.loading) return;
    if (prevStaffCountRef.current >= 0 && staffChat.messages.length > prevStaffCountRef.current && (channel !== 'staff' || !open)) setStaffUnread(true);
    prevStaffCountRef.current = staffChat.messages.length;
    if (open && channel === 'staff') saveLastSeen(sessionId, 'staffchat', staffChat.messages.length);
  }, [staffChat.messages.length, staffChat.loading, channel, open, isStaffOrInstructor, sessionId]);

  useEffect(() => {
    if (open) { const t = setTimeout(() => inputRef.current?.focus(), 200); return () => clearTimeout(t); }
  }, [open]);

  function handleChannelSwitch(ch) {
    setChannel(ch);
    if (ch === 'staff') setStaffUnread(false);
    setInputText('');
  }

  async function handleSend() {
    const text = inputText.trim();
    if (!text || !canSend || sending) return;
    setSending(true);
    const success = await sendMessage(text, senderName, senderType);
    if (success) setInputText('');
    setSending(false);
  }

  const emptyMsg = channel === 'staff' ? '운영팀 내부 채팅입니다' : senderType === 'instructor' ? '학생들과 실시간으로 소통하세요' : '강사와 학생들에게 메시지를 보내세요';
  const tabCls = (active) => `flex-1 py-2.5 text-xs font-medium rounded-lg transition-colors duration-150 ${active ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`;

  // Inline mode: render without modal wrapper (for mobile tab view)
  if (inline && open) {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-slate-800">
        {isStaffOrInstructor && (
          <div className="flex gap-1 px-4 py-2.5 shrink-0">
            <button onClick={() => handleChannelSwitch('public')} className={tabCls(channel === 'public')}>전체 채팅</button>
            <button onClick={() => handleChannelSwitch('staff')} className={`relative ${tabCls(channel === 'staff')} flex items-center justify-center gap-1`}>
              <Shield size={12} />
              운영 채팅
              {staffUnread && channel !== 'staff' && <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
            </button>
          </div>
        )}
        <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 flex flex-col gap-3 scrollbar-hide">
          {loading && messages.length === 0 && <div className="flex-1 flex items-center justify-center"><span className="text-sm text-slate-400 dark:text-slate-500">불러오는 중...</span></div>}
          {!loading && messages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <DoranDoranMascot size="sm" mood="waiting" />
              <p className="text-sm text-slate-400 dark:text-slate-500 text-center leading-relaxed">아직 메시지가 없습니다<br /><span className="text-xs">{emptyMsg}</span></p>
            </div>
          )}
          {messages.map((msg) => <ChatMessage key={msg.id} msg={msg} isOwn={msg.sender === senderName && msg.senderType === senderType} />)}
          <div ref={messagesEndRef} />
        </div>
        <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-100 dark:border-slate-700 shrink-0">
          <input ref={inputRef} type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder={channel === 'staff' ? '운영 메시지를 입력하세요' : '메시지를 입력하세요'} aria-label="채팅 메시지" maxLength={MAX_LENGTH} className="flex-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-slate-400 focus:bg-white dark:focus:bg-slate-600 transition-colors duration-150" />
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => { hapticTap(); handleSend(); }} disabled={!inputText.trim() || !canSend || sending} className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 disabled:opacity-30 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors duration-150 shrink-0" aria-label="메시지 보내기">
            <Send size={16} />
          </motion.button>
        </div>
      </div>
    );
  }

  const panel = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onClose} />
          <motion.div initial={{ opacity: 0, y: '100%' }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 25 }} className="mobile-conversation fixed inset-x-0 bottom-0 top-[max(10vh,env(safe-area-inset-top))] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[420px] sm:h-[600px] bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl sm:shadow-2xl z-50 flex flex-col overflow-hidden">
            {/* Drag handle (mobile only) */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-600" />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 shrink-0">
              <div className="flex items-center gap-2">
                <MessageCircle size={18} className="text-slate-400" />
                <span className="font-bold text-slate-900 dark:text-slate-100">채팅</span>
              </div>
              <button onClick={onClose} className="w-12 h-12 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-150" aria-label="채팅 닫기">
                <X size={18} />
              </button>
            </div>

            {/* Tab bar (staff/instructor only) */}
            {isStaffOrInstructor && (
              <div className="flex gap-1 px-4 py-2 border-b border-slate-50 dark:border-slate-700/50 shrink-0">
                <button onClick={() => handleChannelSwitch('public')} className={tabCls(channel === 'public')}>전체 채팅</button>
                <button onClick={() => handleChannelSwitch('staff')} className={`relative ${tabCls(channel === 'staff')} flex items-center justify-center gap-1`}>
                  <Shield size={12} />
                  운영 채팅
                  {staffUnread && channel !== 'staff' && <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                </button>
              </div>
            )}

            {/* Messages */}
            <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 flex flex-col gap-3 scrollbar-hide">
              {loading && messages.length === 0 && <div className="flex-1 flex items-center justify-center"><span className="text-sm text-slate-400 dark:text-slate-500">불러오는 중...</span></div>}
              {!loading && messages.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center gap-2">
                  <DoranDoranMascot size="sm" mood="waiting" />
                  <p className="text-sm text-slate-400 dark:text-slate-500 text-center leading-relaxed">아직 메시지가 없습니다<br /><span className="text-xs">{emptyMsg}</span></p>
                </div>
              )}
              {messages.map((msg) => <ChatMessage key={msg.id} msg={msg} isOwn={msg.sender === senderName && msg.senderType === senderType} />)}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:py-3 border-t border-slate-100 dark:border-slate-700 shrink-0">
              <input ref={inputRef} type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder={channel === 'staff' ? '운영 메시지를 입력하세요' : '메시지를 입력하세요'} aria-label="채팅 메시지" maxLength={MAX_LENGTH} className="flex-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-slate-400 focus:bg-white dark:focus:bg-slate-600 transition-colors duration-150" />
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => { hapticTap(); handleSend(); }} disabled={!inputText.trim() || !canSend || sending} className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 disabled:opacity-30 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors duration-150 shrink-0" aria-label="메시지 보내기">
                <Send size={16} />
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return inline ? panel : createPortal(panel, document.body);
});
