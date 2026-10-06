import { useRef, useState, useCallback, useEffect, useLayoutEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MessageCircle, X } from 'lucide-react';
import { ref, push, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { getParticipantId, getNickname } from '@/lib/participant';
import { useReactions } from '@/features/reactions/api/useReactions';
import { REACTIONS } from '@/features/reactions/reactionConfig';

const COOLDOWN_MS = 3000;
const BUBBLE_MAX = 20;
// Match the existing RTDB string-length limit without leaving a lone surrogate.
function clampMessage(value) {
  let result = '';
  for (const character of value) {
    if (result.length + character.length > BUBBLE_MAX) break;
    result += character;
  }
  return result;
}
const LABELS = { thumbsup: '좋아요', fire: '열정', heart: '하트', laugh: '재밌어요', clap: '축하해요' };
const tileBase = 'reaction-tile min-h-[84px] min-w-0 w-full px-2 py-3 flex flex-col items-center justify-center gap-2 rounded-2xl border text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400';
const tileRest = 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-slate-700/40 dark:border-slate-600/50 dark:text-slate-100 dark:hover:bg-slate-700';
const tileSelected = 'bg-indigo-50 border-indigo-400 text-indigo-700 dark:bg-indigo-500/20 dark:border-indigo-400 dark:text-indigo-200';

/** A compact chooser. Wire reaction types and chatBubbles retain the existing board protocol. */
export default function ReactionBar({ sessionId, bubbleSessionId, onInputFocus }) {
  const { sendReaction } = useReactions(sessionId, { subscribe: false });
  const reduced = useReducedMotion();
  const mounted = useRef(false);
  const lastReactionAt = useRef(-Infinity);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const [bubbleText, setBubbleText] = useState('');
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [bubbleCooldownUntil, setBubbleCooldownUntil] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!selected) return;
    const timer = setTimeout(() => setSelected(null), 800);
    return () => clearTimeout(timer);
  }, [selected]);
  useEffect(() => {
    if (!bubbleCooldownUntil) return;
    const timer = setTimeout(() => setBubbleCooldownUntil(0), Math.max(0, bubbleCooldownUntil - performance.now()));
    return () => clearTimeout(timer);
  }, [bubbleCooldownUntil]);
  useLayoutEffect(() => {
    if (bubbleOpen) inputRef.current?.focus({ preventScroll: true });
  }, [bubbleOpen]);

  const handleReaction = useCallback(async (type) => {
    const now = performance.now();
    if (now - lastReactionAt.current < COOLDOWN_MS) {
      setFeedback('잠시 후 다시 보낼 수 있어요.');
      return;
    }
    lastReactionAt.current = now;
    setSelected(type);
    setFeedback('');
    if (!reduced && 'vibrate' in navigator) navigator.vibrate(8);
    const sent = await sendReaction(type);
    if (!mounted.current) return;
    if (!sent) lastReactionAt.current = -Infinity;
    setFeedback(sent ? `${LABELS[type]} 반응을 보냈어요.` : '반응을 보내지 못했어요. 다시 시도해 주세요.');
  }, [sendReaction, reduced]);

  const handleBubbleSend = useCallback(async (event) => {
    event?.preventDefault();
    const text = bubbleText.trim(), sid = bubbleSessionId || sessionId;
    if (!text || !sid || sendingRef.current || bubbleCooldownUntil) return;
    sendingRef.current = true;
    setSending(true);
    try {
      await push(ref(db, `sessions/${sid}/chatBubbles`), {
        text, nickname: getNickname() || '익명', participantId: getParticipantId(), timestamp: serverTimestamp(),
      });
      if (!mounted.current) return;
      setBubbleText('');
      setBubbleOpen(false);
      setFeedback('한마디를 보냈어요.');
      setBubbleCooldownUntil(performance.now() + COOLDOWN_MS);
    } catch {
      if (mounted.current) setFeedback('한마디를 보내지 못했어요. 다시 시도해 주세요.');
    } finally {
      sendingRef.current = false;
      if (mounted.current) setSending(false);
    }
  }, [bubbleText, bubbleSessionId, sessionId, bubbleCooldownUntil]);

  return <div className="space-y-3" data-compose-open={bubbleOpen}>
    <div className="grid gap-2" data-reaction-grid style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, max(30%, 5.25rem)), 1fr))' }}>
      {REACTIONS.map(({ type, icon: Icon }) => <motion.button key={type} type="button" onClick={() => handleReaction(type)} aria-label={LABELS[type]} aria-pressed={selected === type}
        whileTap={{ scale: reduced ? 1 : 0.97 }} transition={{ duration: 0.1 }} className={`${tileBase} ${selected === type ? tileSelected : tileRest}`}>
        <Icon size={26} strokeWidth={1.8} className="shrink-0 text-indigo-500 dark:text-indigo-300" fill={selected === type && type === 'heart' ? 'currentColor' : 'none'} aria-hidden="true" />
        <span className="max-w-full text-center [word-break:keep-all] [overflow-wrap:anywhere]">{LABELS[type]}</span>
      </motion.button>)}
      {bubbleSessionId && <motion.button type="button" onClick={() => setBubbleOpen((open) => !open)} aria-label="한마디 입력" aria-expanded={bubbleOpen} aria-controls="reaction-word-editor"
        whileTap={{ scale: reduced ? 1 : 0.97 }} transition={{ duration: 0.1 }} className={`${tileBase} ${bubbleOpen ? tileSelected : tileRest}`}>
        <MessageCircle size={26} strokeWidth={1.8} className="shrink-0 text-indigo-500 dark:text-indigo-300" aria-hidden="true" /><span>한마디</span>
      </motion.button>}
    </div>
    {bubbleOpen && <form id="reaction-word-editor" onSubmit={handleBubbleSend} className="border-t border-slate-200 dark:border-slate-700 pt-2 space-y-2">
      <div className="flex items-center justify-between gap-2"><label htmlFor="reaction-word-input" className="text-sm font-semibold text-slate-700 dark:text-slate-200">한마디</label><button type="button" onClick={() => setBubbleOpen(false)} aria-label="한마디 입력 닫기" className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"><X size={18} /></button></div>
      <div className="flex items-center gap-2" data-message-controls>
        <div className="relative flex-1 min-w-0">
          <input id="reaction-word-input" ref={inputRef} type="text" value={bubbleText} onChange={(event) => setBubbleText(clampMessage(event.target.value))} disabled={sending} placeholder="입력해 주세요" aria-label="한마디 내용" enterKeyHint="send" onFocus={onInputFocus}
            onKeyDown={(event) => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault(); }}
            className={`w-full min-h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 px-3 py-3 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${bubbleText ? 'pr-12' : ''}`} />
          {bubbleText && <button type="button" onClick={() => { setBubbleText(''); inputRef.current?.focus(); }} disabled={sending} aria-label="입력 지우기" className="absolute right-0 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-300"><X size={16} /></button>}
        </div>
        <button type="submit" disabled={!bubbleText.trim() || sending || Boolean(bubbleCooldownUntil)} aria-label="한마디 보내기" className="min-h-12 shrink-0 px-3 rounded-xl bg-indigo-600 dark:bg-indigo-400 text-white dark:text-slate-950 font-semibold text-sm disabled:opacity-40">{sending ? '보내는 중' : '보내기'}</button>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{bubbleText.length}/{BUBBLE_MAX}자 · 일부 이모지는 2자 이상으로 셉니다</p>
    </form>}
    {feedback && <p role="status" className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{feedback}</p>}
  </div>;
}
