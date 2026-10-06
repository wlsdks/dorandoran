import { useEffect, useRef, useState, memo, useCallback } from 'react';
import { onValue, ref } from 'firebase/database';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '@/lib/firebase';
import { arrivalLabel } from '@/lib/wordcloud-layout';

const MAX_BUBBLES = 12;
const MAX_TEXT_LEN = 15;
const BUBBLE_LIFETIME_MS = 3400;
const THROTTLE_MS = 200; // 버블 간 최소 간격
const COALESCE_MS = 1200; // 내용을 숨기는 화면: 이 간격 안에 들어온 응답은 '+N 응답' 하나로 모은다

function hashSeed(value) {
  return String(value).split('').reduce((s, c, i) => (s * 33 + c.charCodeAt(0) + i) % 2147483647, 7);
}

// hideText: 전자칠판처럼 모두가 보는 화면에서는 답 내용을 띄우지 않고(정답 공개 전 노출 방지) 응답이 들어왔다는 신호만 준다.
export default memo(function AnswerBubbleOverlay({ sessionId, questionId, hideText = false }) {
  const [bubbles, setBubbles] = useState([]);
  const mountedRef = useRef(true);
  const timersRef = useRef([]);
  const prevKeysRef = useRef(new Set());
  const queueRef = useRef([]);
  const drainTimerRef = useRef(null);
  const pendingRef = useRef({ count: 0, timer: null, seed: 0 });

  const active = !!(sessionId && questionId);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timersRef.current.forEach(clearTimeout);
      if (drainTimerRef.current) clearInterval(drainTimerRef.current);
    };
  }, []);

  // 큐에서 하나씩 꺼내서 버블 추가 (THROTTLE_MS 간격)
  const startDrain = useCallback(() => {
    if (drainTimerRef.current) return; // 이미 실행 중
    drainTimerRef.current = setInterval(() => {
      if (!mountedRef.current || queueRef.current.length === 0) {
        clearInterval(drainTimerRef.current);
        drainTimerRef.current = null;
        return;
      }
      const bubble = queueRef.current.shift();
      setBubbles(prev => [...prev.slice(-(MAX_BUBBLES - 1)), bubble]);
      const t = setTimeout(() => {
        timersRef.current = timersRef.current.filter((x) => x !== t); // fire된 타이머 누적 방지
        if (!mountedRef.current) return;
        setBubbles(prev => prev.filter(b => b.id !== bubble.id));
      }, bubble.duration * 1000);
      timersRef.current.push(t);
    }, THROTTLE_MS);
  }, []);

  // Firebase listener
  useEffect(() => {
    if (!active) {
      prevKeysRef.current = new Set();
      queueRef.current = [];
      setBubbles([]);
      if (drainTimerRef.current) { clearInterval(drainTimerRef.current); drainTimerRef.current = null; }
      return;
    }

    const votesRef = ref(db, `sessions/${sessionId}/questions/${questionId}/votes`);
    const isFirstRef = { current: true };

    const unsubscribe = onValue(votesRef, (snapshot) => {
      if (!mountedRef.current) return;
      const data = snapshot.val() || {};
      const currentKeys = new Set(Object.keys(data));

      if (isFirstRef.current) {
        prevKeysRef.current = currentKeys;
        isFirstRef.current = false;
        return;
      }

      const enqueue = (key, text) => {
        const seed = hashSeed(key);
        if (queueRef.current.length > 50) queueRef.current.shift(); // 큐 제한
        queueRef.current.push({
          id: `${key}-${Date.now()}-${Math.random()}`,
          text: text.length > MAX_TEXT_LEN ? text.slice(0, MAX_TEXT_LEN) + '…' : text,
          left: 8 + (seed % 75),
          drift: ((Math.floor(seed / 7) % 30) - 15) * 2,
          duration: (BUBBLE_LIFETIME_MS + (seed % 600)) / 1000,
          rotate: (Math.floor(seed / 13) % 8) - 4,
        });
        startDrain();
      };
      // 새 키만 큐에 추가
      for (const key of currentKeys) {
        if (prevKeysRef.current.has(key)) continue;
        const vote = data[key];
        if (!vote?.value) continue;
        if (hideText) {
          // 내용 없는 '응답' 알갱이를 200개 띄우면 화면만 덮는다 — 1.2초 안에 온 응답을 '+N 응답' 하나로 모은다.
          const pending = pendingRef.current;
          pending.count += 1;
          pending.seed = hashSeed(key);
          if (!pending.timer) pending.timer = setTimeout(() => {
            pending.timer = null;
            const count = pending.count; pending.count = 0;
            if (mountedRef.current && count > 0) enqueue(`arrivals-${pending.seed}`, arrivalLabel(count));
          }, COALESCE_MS);
          continue;
        }
        const text = String(vote.value).trim();
        if (text) enqueue(key, text);
      }
      prevKeysRef.current = currentKeys;
    });

    return () => {
      unsubscribe();
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      queueRef.current = [];
      clearTimeout(pendingRef.current.timer);
      pendingRef.current = { count: 0, timer: null, seed: 0 };
      prevKeysRef.current = new Set();
      if (drainTimerRef.current) { clearInterval(drainTimerRef.current); drainTimerRef.current = null; }
      setBubbles([]);
    };
  }, [active, sessionId, questionId, startDrain, hideText]);

  if (!active || bubbles.length === 0) return null;

  return (
    <div className="fixed inset-0 z-30 pointer-events-none overflow-hidden">
      <AnimatePresence>
        {bubbles.map((bubble) => (
          <motion.div
            key={bubble.id}
            initial={{ opacity: 0, y: 0, scale: 0.5 }}
            animate={{
              opacity: [0, 0.95, 0.9, 0.7, 0],
              y: [0, -50, -180, -350, -550],
              x: [0, bubble.drift * 0.3, -bubble.drift * 0.4, bubble.drift * 0.6, 0],
              scale: [0.5, 1, 0.95, 0.85, 0.6],
              rotate: [0, bubble.rotate, -bubble.rotate * 0.5, bubble.rotate * 0.3, 0],
            }}
            exit={{ opacity: 0, scale: 0.3, transition: { duration: 0.1 } }}
            transition={{
              duration: bubble.duration,
              ease: [0.15, 0.7, 0.25, 0.95],
              times: [0, 0.1, 0.4, 0.7, 1],
            }}
            className="absolute bottom-24"
            style={{ left: `${bubble.left}%` }}
          >
            <div className="px-4 py-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-600/60 shadow-lg max-w-[220px]">
              <p className="text-base font-semibold text-slate-700 dark:text-slate-200 truncate leading-tight">
                {bubble.text}
              </p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
});
