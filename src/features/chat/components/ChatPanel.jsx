import { useState, useEffect, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import { Send, Shield } from 'lucide-react';
import { hapticTap } from '@/lib/haptics';
import BottomSheet from '@/components/ui/BottomSheet';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import { useChat } from '@/features/chat/api/useChat';
import { useStaffChat } from '@/features/dm/api/useStaffChat';
import { getLastSeen, saveLastSeen } from '@/lib/participant';
import ChatMessage from '@/features/chat/components/ChatMessage';

const MAX_LENGTH = 500;

export default memo(function ChatPanel({ sessionId, senderName, senderType, open, onClose, onNewMessage, inline = false }) {
  const isStaffOrInstructor = senderType === 'staff' || senderType === 'instructor';
  const [channel, setChannel] = useState('public');

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
  const tabCls = (active) => `flex-1 min-h-11 py-2.5 text-sm font-medium rounded-lg transition-colors duration-150 ${active ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`;

  const tabs = isStaffOrInstructor && (
    <div className="flex gap-1 px-4 py-2 shrink-0 border-b border-slate-100 dark:border-slate-700">
      <button onClick={() => handleChannelSwitch('public')} className={tabCls(channel === 'public')}>전체 채팅</button>
      <button onClick={() => handleChannelSwitch('staff')} className={`relative ${tabCls(channel === 'staff')} flex items-center justify-center gap-1`}>
        <Shield size={12} />
        운영 채팅
        {staffUnread && channel !== 'staff' && <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
      </button>
    </div>
  );
  const list = (
    <div ref={containerRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 flex flex-col gap-3 scrollbar-hide">
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
  );
  const composer = (
    <div className={`flex items-center gap-2 px-4 pt-3 border-t border-slate-100 dark:border-slate-700 shrink-0 ${inline ? 'pb-3' : 'pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3'}`}>
      <input ref={inputRef} type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder={channel === 'staff' ? '운영 메시지를 입력하세요' : '메시지를 입력하세요'} aria-label="채팅 메시지" maxLength={MAX_LENGTH} enterKeyHint="send" className="flex-1 min-w-0 min-h-12 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-slate-400 focus:bg-white dark:focus:bg-slate-600 transition-colors duration-150" />
      <motion.button whileTap={{ scale: 0.9 }} onClick={() => { hapticTap(); handleSend(); }} disabled={!inputText.trim() || !canSend || sending} className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 disabled:opacity-30 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors duration-150 shrink-0" aria-label="메시지 보내기">
        <Send size={16} />
      </motion.button>
    </div>
  );

  // Inline mode: render without sheet wrapper (for the instructor's mobile tab view)
  if (inline) {
    return open ? <div className="flex flex-col h-full bg-white dark:bg-slate-800">{tabs}{list}{composer}</div> : null;
  }
  return (
    <BottomSheet open={open} onClose={onClose} variant="full" title="채팅" ariaLabel={channel === 'staff' ? '운영 채팅' : '전체 채팅'}>
      {tabs}{list}{composer}
    </BottomSheet>
  );
});
