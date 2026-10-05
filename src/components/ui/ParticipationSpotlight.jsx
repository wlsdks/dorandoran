import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { useRealtimeValue } from '@/hooks/useRealtimeValue';

/** 최대 1분에 한 번, 4초만 표시한다. 점수나 학습 능력을 과장하지 않는다. */
export default function ParticipationSpotlight({ sessionId }) {
  const { value } = useRealtimeValue(sessionId ? `sessions/${sessionId}/participationSpotlight` : null);
  const [shown, setShown] = useState(null);
  const previous = useRef(null);
  const lastShown = useRef(-Infinity);
  const key = value ? `${sessionId}:${value.id}:${value.milestone}` : null;
  useEffect(() => {
    if (!key || previous.current === key) return;
    previous.current = key;
    if (performance.now() - lastShown.current < 60_000) return;
    lastShown.current = performance.now();
    setShown({ sessionId, ...value });
  }, [key, value, sessionId]);
  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(null), 4000);
    return () => clearTimeout(timer);
  }, [shown]);
  return <AnimatePresence>{shown?.sessionId === sessionId && <motion.div role="status" aria-live="polite"
    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.25 }}
    className="fixed top-20 right-5 z-20 flex items-center gap-2.5 rounded-xl border border-slate-700 bg-slate-900/95 px-4 py-2.5 text-slate-100 shadow-sm pointer-events-none">
    <Trophy size={18} className="text-slate-400" /><div><p className="text-sm font-semibold">참여 리더 · {shown.name}</p>
    <p className="text-xs text-slate-400">{shown.count}문항에 함께하고 있어요</p></div>
  </motion.div>}</AnimatePresence>;
}
