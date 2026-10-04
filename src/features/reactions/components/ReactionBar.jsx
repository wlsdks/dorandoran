import { useRef, useState, useMemo, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, X } from 'lucide-react';
import { ref, push, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { getParticipantId, getNickname } from '@/lib/participant';
import { useReactions } from '@/features/reactions/api/useReactions';
import { REACTIONS } from '@/features/reactions/reactionConfig';

const COOLDOWN_MS = 3000; // 스펙: 학생당 3초 1회 — 300명 시 write 폭주(최대 ~600/s → ~100/s)로 감소
const FLASH_MS = 500;
const PARTICLE_COUNT = 8;

/** Tiny dot particles that burst outward on tap. */
function TapParticles({ color }) {
  // useMemo로 mount 시 한 번만 평가 — render body에서 Math.random 호출 회피.
  // 결정적 분포(seeded)는 시각 효과상 불필요 (튀는 입자라 random 본 의미가 자연스러움)
  const particles = useMemo(
    () => Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const angle = (i / PARTICLE_COUNT) * 360;
      const rad = (angle * Math.PI) / 180;
       
      const distance = 22 + Math.random() * 14;
      return {
        id: i,
        x: Math.cos(rad) * distance,
        y: Math.sin(rad) * distance,
         
        size: 3 + Math.random() * 3,
      };
    }),
    []
  );

  return (
    <div className="absolute inset-0 pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          animate={{ opacity: 0, x: p.x, y: p.y, scale: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="absolute top-1/2 left-1/2 rounded-full"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: color,
            marginLeft: -p.size / 2,
            marginTop: -p.size / 2,
          }}
        />
      ))}
    </div>
  );
}

/** Single reaction button with tap feedback + particles. */
const ReactionButton = memo(function ReactionButton({ reaction, isFlash, isShaking, onTap }) {
  const { type, icon: Icon, label, buttonClass, activeClass, accentColor } = reaction;

  return (
    <div className="relative">
      <motion.button
        whileTap={{ scale: 0.9 }}
        animate={isShaking ? { x: [0, -2, 2, 0] } : { x: 0 }}
        transition={isShaking ? { duration: 0.2 } : { type: 'spring', stiffness: 500, damping: 30 }}
        onClick={() => onTap(type)}
        aria-label={label}
        className={`relative flex h-12 w-12 items-center justify-center rounded-xl border transition-colors duration-200 ${
          isFlash ? activeClass : buttonClass
        }`}
      >
        <Icon
          size={20}
          fill={isFlash && type === 'heart' ? 'currentColor' : 'none'}
        />
      </motion.button>
      <AnimatePresence>
        {isFlash && <TapParticles color={accentColor} />}
      </AnimatePresence>
    </div>
  );
});

const BUBBLE_MAX = 20;
const BUBBLE_COOLDOWN = 3000;

export default function ReactionBar({ sessionId, bubbleSessionId }) {
  const { sendReaction } = useReactions(sessionId, { subscribe: false });
  const [flashType, setFlashType] = useState(null);
  const cooldownRef = useRef(-Infinity);
  const flashTimerRef = useRef(null);
  const shakeTimerRef = useRef(null);

  // 학생 본인 화면에도 이모지가 떠오르게 — 탭 즉시 "반응했다"는 만족 피드백(전자칠판 안 봐도 됨).
  // Firebase 구독 없이 로컬 애니메이션이라 가볍고 즉각적. 전자칠판 오버레이와 별개.
  const [floaters, setFloaters] = useState([]);
  const floaterIdRef = useRef(0);
  const floaterTimersRef = useRef(new Set());
  const spawnFloater = useCallback((type) => {
    const reaction = REACTIONS.find((r) => r.type === type);
    if (!reaction) return;
    const id = ++floaterIdRef.current;
    const drift = ((id * 37) % 60) - 30; // 결정적 좌우 분산(연타 시 겹침 방지)
    setFloaters((f) => [...f, { id, Icon: reaction.icon, color: reaction.accentColor, type, drift }]);
    const timer = setTimeout(() => { floaterTimersRef.current.delete(timer); setFloaters((f) => f.filter((x) => x.id !== id)); }, 1200);
    floaterTimersRef.current.add(timer);
  }, []);

  // Bubble input state
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const barRef = useRef(null);
  const [bubbleText, setBubbleText] = useState('');
  const [canBubble, setCanBubble] = useState(true);
  const bubbleSendingRef = useRef(false); // 동기적 중복 방지
  const bubbleInputRef = useRef(null);
  const bubbleCooldownRef = useRef(null);

  useEffect(() => () => {
    floaterTimersRef.current.forEach(clearTimeout); floaterTimersRef.current.clear();
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    if (bubbleCooldownRef.current) clearTimeout(bubbleCooldownRef.current);
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
  }, []);

  // 한마디 입력이 열려 있을 때 바깥 터치/클릭하면 닫기
  useEffect(() => {
    if (!bubbleOpen) return;
    const onOutside = (e) => {
      if (barRef.current && !barRef.current.contains(e.target)) setBubbleOpen(false);
    };
    document.addEventListener('pointerdown', onOutside);
    return () => document.removeEventListener('pointerdown', onOutside);
  }, [bubbleOpen]);

  const [cooldownShake, setCooldownShake] = useState(null);

  const handleReaction = useCallback((type) => {
    const now = performance.now();
    if (now - cooldownRef.current < COOLDOWN_MS) {
      setCooldownShake(type);
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = setTimeout(() => setCooldownShake(null), 300);
      return;
    }
    cooldownRef.current = now;
    if ('vibrate' in navigator) navigator.vibrate(8);
    setFlashType(type);
    spawnFloater(type);
    sendReaction(type);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashType(null), FLASH_MS);
  }, [sendReaction, spawnFloater]);

  const handleBubbleSend = useCallback(async () => {
    const sid = bubbleSessionId || sessionId;
    const trimmed = bubbleText.trim();
    if (!trimmed || !canBubble || !sid || bubbleSendingRef.current) return;
    bubbleSendingRef.current = true; // 즉시 차단 (동기)
    try {
      await push(ref(db, `sessions/${sid}/chatBubbles`), {
        text: trimmed,
        nickname: getNickname() || '익명',
        participantId: getParticipantId(),
        timestamp: serverTimestamp(),
      });
      setBubbleText('');
      setBubbleOpen(false);
      setCanBubble(false);
      bubbleCooldownRef.current = setTimeout(() => {
        setCanBubble(true);
        bubbleSendingRef.current = false;
      }, BUBBLE_COOLDOWN);
    } catch {
      bubbleSendingRef.current = false;
    }
  }, [bubbleText, canBubble, bubbleSessionId, sessionId]);

  return (
    <div className="relative" ref={barRef}>
      {/* 본인 화면 이모지 플로터 — 탭 위치에서 위로 떠오르며 페이드(로컬 피드백) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center overflow-visible z-10">
        <AnimatePresence>
          {floaters.map((f) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 4, scale: 0.4 }}
              animate={{ opacity: [0, 1, 1, 0], y: -84, scale: [0.4, 1.3, 1, 0.85], x: f.drift }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.1, ease: 'easeOut', times: [0, 0.2, 0.6, 1] }}
              className="absolute"
              style={{ color: f.color }}
            >
              <f.Icon size={30} fill={f.type === 'heart' ? 'currentColor' : 'none'} strokeWidth={2} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Bubble input popup */}
      <AnimatePresence>
        {bubbleOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="absolute -top-14 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-white dark:bg-slate-700 rounded-full shadow-lg border border-slate-200 dark:border-slate-600 pl-4 pr-1.5 py-1.5 z-10"
          >
            <input
              ref={bubbleInputRef}
              type="text"
              value={bubbleText}
              onChange={e => setBubbleText([...e.target.value].slice(0, BUBBLE_MAX).join(''))}
              onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleBubbleSend(); if (e.key === 'Escape') setBubbleOpen(false); }}
              placeholder="한마디..."
              maxLength={BUBBLE_MAX}
              className="w-28 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
              autoFocus
            />
            <button
              onClick={handleBubbleSend}
              disabled={!bubbleText.trim() || !canBubble}
              className="w-8 h-8 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center disabled:opacity-30 transition-colors shrink-0"
            >
              <Send size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-center gap-1.5">
        {REACTIONS.map((reaction) => (
          <ReactionButton
            key={reaction.type}
            reaction={reaction}
            isFlash={flashType === reaction.type}
            isShaking={cooldownShake === reaction.type}
            onTap={handleReaction}
          />
        ))}
        {/* Bubble button — inline with reactions */}
        {bubbleSessionId && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => { setBubbleOpen(v => !v); setTimeout(() => bubbleInputRef.current?.focus(), 100); }}
            disabled={!canBubble && !bubbleOpen}
            className={`relative flex h-12 w-12 items-center justify-center rounded-xl border transition-colors duration-200 ${
              bubbleOpen
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                : `border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 ${canBubble ? 'active:bg-slate-100 dark:active:bg-slate-700' : 'opacity-40'}`
            }`}
            aria-label="한마디 보내기"
          >
            <MessageCircle size={20} />
          </motion.button>
        )}
      </div>
    </div>
  );
}
