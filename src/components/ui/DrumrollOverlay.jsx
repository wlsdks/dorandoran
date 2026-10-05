import { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import DoranDoranMascot from './DoranDoranMascot';
import { useMediaQuery } from '@/hooks/useMediaQuery';

/** 짧은 한 번의 가속→정지→공개. 화면으로만 공개 상태를 전달한다. */
export default memo(function DrumrollOverlay({ active, onComplete, duration = 2500 }) {
  const [phase, setPhase] = useState(0);
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; });
  useEffect(() => {
    if (!active) { setPhase(0); return; }
    const timers = [setTimeout(() => setPhase(1), duration * 0.3), setTimeout(() => setPhase(2), duration * 0.67),
      setTimeout(() => setPhase(3), duration * 0.9), setTimeout(() => onCompleteRef.current?.(), duration)];
    return () => timers.forEach(clearTimeout);
  }, [active, duration]);
  if (typeof document === 'undefined') return null;
  return createPortal(<AnimatePresence>{active && <motion.div role="status" aria-live="polite"
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
    className="fixed inset-0 z-[80] bg-slate-950/95 flex items-center justify-center p-6">
    <div className="text-center w-full max-w-3xl">
      <p className="text-indigo-200 text-lg sm:text-2xl font-semibold mb-6">잠시 후, 정답을 공개합니다</p>
      <motion.div animate={reduced ? {} : { scale: phase === 3 ? 1 : [1, 1.025, 1] }} transition={{ duration: phase > 1 ? 0.25 : 0.5 }} className="flex justify-center mb-6">
        <DoranDoranMascot size={180} mood={phase === 3 ? 'happy' : 'thinking'} animated={false} />
      </motion.div>
      <p className="text-[clamp(2.5rem,6vw,6rem)] font-extrabold tracking-tight text-slate-50 leading-tight">{phase === 3 ? '정답은…' : '두구두구'}</p>
      <div className="mt-8 h-2 max-w-md mx-auto bg-slate-700 rounded-full overflow-hidden"><motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: duration / 1000, ease: 'linear' }} className="h-full w-full origin-left bg-indigo-300" /></div>
    </div>
  </motion.div>}</AnimatePresence>, document.body);
});
