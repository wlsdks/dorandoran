import { useEffect, useRef, useState, memo } from 'react';
import { onChildAdded, ref, query, limitToLast } from 'firebase/database';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '@/lib/firebase';

const MAX_BUBBLES = 6;
const LIFETIME_MS = 3000;

/**
 * Floating chat bubbles. Only shows NEW bubbles (ignores existing on mount).
 * Uses onChildAdded + skip-initial pattern for dedup.
 */
export default memo(function ChatBubbleOverlay({ sessionId }) {
  const [bubbles, setBubbles] = useState([]);
  const seenRef = useRef(new Set());
  const mountedRef = useRef(true);
  const timersRef = useRef([]); // 버블 제거 + initialLoad 타이머 추적 → cleanup에서 일괄 정리

  useEffect(() => {
    mountedRef.current = true;
    seenRef.current = new Set();
    return () => { mountedRef.current = false; };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    // limitToLast로 마운트 시 chatBubbles 전체 히스토리 다운로드 방지 (300명 누적분 차단)
    const bubbleRef = query(ref(db, `sessions/${sessionId}/chatBubbles`), limitToLast(MAX_BUBBLES));
    let initialLoad = true;

    const unsub = onChildAdded(bubbleRef, (snap) => {
      // Skip all entries from initial load
      if (initialLoad) return;
      if (!mountedRef.current) return;

      const key = snap.key;
      if (seenRef.current.has(key)) return;
      seenRef.current.add(key);

      const data = snap.val();
      if (!data?.text) return;

      const seed = key.split('').reduce((s, c) => (s * 33 + c.charCodeAt(0)) % 2147483647, 7);
      const bubble = {
        id: key,
        text: (data.text || '').slice(0, 20),
        nickname: data.nickname || '',
        x: 20 + (seed % 55),
      };

      setBubbles(prev => [...prev.slice(-(MAX_BUBBLES - 1)), bubble]);
      const t = setTimeout(() => {
        timersRef.current = timersRef.current.filter((x) => x !== t);
        seenRef.current.delete(key); // dedup Set 무한 증가 방지 — 표시 끝난 키 제거
        if (mountedRef.current) setBubbles(prev => prev.filter(b => b.id !== key));
      }, LIFETIME_MS);
      timersRef.current.push(t);
    });

    // After initial snapshot fires, mark ready
    const initTimer = setTimeout(() => { initialLoad = false; }, 500);
    timersRef.current.push(initTimer);

    return () => { unsub(); timersRef.current.forEach(clearTimeout); timersRef.current = []; };
  }, [sessionId]);

  return (
    <div className="fixed inset-0 z-30 pointer-events-none overflow-hidden">
      <AnimatePresence>
        {bubbles.map(b => (
          <motion.div
            key={b.id}
            initial={{ opacity: 0, y: 0, scale: 0.85 }}
            animate={{ opacity: 1, y: -160, scale: 1 }}
            exit={{ opacity: 0, y: -190, scale: 0.9, transition: { duration: 0.3, ease: 'easeIn' } }}
            transition={{ duration: 2.5, ease: 'easeOut' }}
            className="absolute bottom-40"
            style={{ left: `${b.x}%` }}
          >
            <div className="bg-white/95 dark:bg-slate-700/95 rounded-2xl px-3 py-1.5 shadow-md">
              <p className="text-[13px] font-medium text-slate-900 dark:text-slate-100 leading-tight whitespace-nowrap">{b.text}</p>
              <p className="text-[9px] text-slate-400 mt-0.5">{b.nickname}</p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
});
