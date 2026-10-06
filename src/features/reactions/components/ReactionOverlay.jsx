import { useEffect, useRef, useState, memo } from 'react';
import { limitToLast, onChildAdded, query, ref } from 'firebase/database';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '@/lib/firebase';
import { limits, timing } from '@/lib/design-tokens';
import { REACTION_META } from '@/features/reactions/reactionConfig';

function hashSeed(value) {
  return String(value).split('').reduce((seed, char, index) => (
    (seed * 33 + char.charCodeAt(0) + index) % 2147483647
  ), 7);
}

function createBubbleConfig(key, type) {
  const seed = hashSeed(key);
  return {
    id: `${key}-${type}`,
    type,
    left: 12 + (seed % 72),
    drift: ((Math.floor(seed / 7) % 40) - 20) * 2,
    size: 38 + (Math.floor(seed / 17) % 10),
    duration: (timing.reactionBubbleLifetime + 800 + (seed % 600)) / 1000,
    rotate: (Math.floor(seed / 13) % 12) - 6,
  };
}

// 몰려온 반응은 대기열에 쌓았다가 일정한 간격으로 흘려보낸다 — 90명이 동시에 눌러도 화면이 한꺼번에 덮이지 않게.
const RELEASE_INTERVAL_MS = 110;
const MAX_QUEUE = 60;

export default memo(function ReactionOverlay({ sessionId }) {
  const [bubbles, setBubbles] = useState([]);
  const queueRef = useRef([]);
  const visibleRef = useRef(0);
  const mountedRef = useRef(true);
  const warmupTimerRef = useRef(null);
  const cleanupTimersRef = useRef([]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (warmupTimerRef.current) clearTimeout(warmupTimerRef.current);
      cleanupTimersRef.current.forEach(clearTimeout);
      cleanupTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    let ready = false;
    warmupTimerRef.current = setTimeout(() => {
      ready = true;
    }, 400);

    const reactionsRef = query(ref(db, `sessions/${sessionId}/reactions`), limitToLast(40));
    const unsubscribe = onChildAdded(reactionsRef, (snapshot) => {
      if (!ready || !mountedRef.current) return;

      const latest = snapshot.val();
      if (!latest?.type) return;

      queueRef.current.push(createBubbleConfig(snapshot.key, latest.type));
      // 너무 많이 밀리면 오래된 것부터 버린다(지금 분위기를 보여주는 게 목적이라 최신 반응이 우선).
      if (queueRef.current.length > MAX_QUEUE) queueRef.current.splice(0, queueRef.current.length - MAX_QUEUE);
    });

    const release = setInterval(() => {
      if (!mountedRef.current || !queueRef.current.length || visibleRef.current >= limits.maxReactionBubbles) return;
      const bubble = queueRef.current.shift();
      visibleRef.current += 1;
      setBubbles((prev) => [...prev, bubble]);
      const removeTimer = setTimeout(() => {
        // 자기 자신을 배열에서 제거 — fire된 타이머 ID 무한 누적 방지(수업 내내 켜둔 전자칠판)
        cleanupTimersRef.current = cleanupTimersRef.current.filter((t) => t !== removeTimer);
        visibleRef.current = Math.max(0, visibleRef.current - 1);
        if (!mountedRef.current) return;
        setBubbles((prev) => prev.filter((item) => item.id !== bubble.id));
      }, bubble.duration * 1000);
      cleanupTimersRef.current.push(removeTimer);
    }, RELEASE_INTERVAL_MS);

    return () => {
      ready = false;
      clearInterval(release);
      queueRef.current = [];
      visibleRef.current = 0;
      unsubscribe();
      if (warmupTimerRef.current) clearTimeout(warmupTimerRef.current);
      cleanupTimersRef.current.forEach(clearTimeout);
      cleanupTimersRef.current = [];
    };
  }, [sessionId]);

  return (
    <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden">
      <AnimatePresence>
        {bubbles.map((bubble) => {
          const reaction = REACTION_META[bubble.type] || REACTION_META.thumbsup;
          const Icon = reaction.icon;
          const fillHeart = bubble.type === 'heart';

          return (
            <motion.div
              data-reaction-bubble
              key={bubble.id}
              initial={{ opacity: 0, y: 0, scale: 0.2 }}
              animate={{
                opacity: [0, 1, 0.95, 0.8, 0],
                y: [0, -60, -200, -400, -650],
                x: [0, bubble.drift * 0.4, -bubble.drift * 0.5, bubble.drift * 0.8, -bubble.drift * 0.3],
                scale: [0.2, 1.2, 1.05, 0.9, 0.6],
                rotate: [0, bubble.rotate * 1.5, -bubble.rotate, bubble.rotate * 0.5, 0],
              }}
              exit={{ opacity: 0, scale: 0.3, transition: { duration: 0.1 } }}
              transition={{
                duration: bubble.duration,
                ease: [0.15, 0.7, 0.25, 0.95],
                times: [0, 0.1, 0.4, 0.7, 1],
              }}
              className="absolute bottom-[max(4.75rem,env(safe-area-inset-bottom))]"
              style={{ left: `${bubble.left}%` }}
            >
              {/* 무한 펄스 제거 — 외부 keyframe scale이 이미 생동감 제공. 동시 버블 최대 15개 × repeat:Infinity 제거로 프레임 비용 절감 */}
              <div
                className={`flex items-center justify-center rounded-full border shadow-md ${reaction.bubbleBg} ${reaction.bubbleBorder}`}
                style={{ width: bubble.size, height: bubble.size }}
              >
                <Icon
                  size={Math.round(bubble.size * 0.46)}
                  className={reaction.bubbleIcon}
                  fill={fillHeart ? 'currentColor' : 'none'}
                />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
});
