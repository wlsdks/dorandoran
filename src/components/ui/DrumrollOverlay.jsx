import { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import './DrumrollOverlay.css';

/** One bounded countdown. Timers and animations stop on cancellation or unmount. */
export default memo(function DrumrollOverlay({ active, onComplete, duration = 2500 }) {
  const [phase, setPhase] = useState(0);
  const reduced = useReducedMotion();
  const onCompleteRef = useRef(onComplete);
  const totalMs = Number.isFinite(duration) ? Math.max(0, duration) : 2500;
  useEffect(() => { onCompleteRef.current = onComplete; });
  useEffect(() => {
    setPhase(0);
    if (!active) return;
    const timers = [
      setTimeout(() => setPhase(1), totalMs * 0.27),
      setTimeout(() => setPhase(2), totalMs * 0.54),
      setTimeout(() => setPhase(3), totalMs * 0.8),
      setTimeout(() => onCompleteRef.current?.(), totalMs),
    ];
    return () => timers.forEach(clearTimeout);
  }, [active, totalMs]);
  if (typeof document === 'undefined') return null;

  return createPortal(<AnimatePresence>{active && <motion.div
    className="reveal-overlay" role="status" aria-live="polite" aria-atomic="true"
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    transition={{ duration: reduced ? 0.08 : 0.2 }}>
    <motion.div className="reveal-scene"
      initial={{ opacity: 0, y: reduced ? 0 : 12 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduced ? 0 : 12 }} transition={{ duration: reduced ? 0.08 : 0.32, ease: 'easeOut' }}>
      <p className="reveal-eyebrow"><Sparkles size={20} aria-hidden="true" />정답 공개</p>
      <h2 className="reveal-heading">어떤 답을 고르셨나요?</h2>
      <p className="reveal-description">잠시 후, 정답을 공개합니다</p>

      <div className="reveal-countdown" aria-hidden="true">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={phase} className={phase === 3 ? 'reveal-countdown-ready' : ''}
            initial={{ opacity: 0, y: reduced ? 0 : 24 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : -24, transition: { duration: reduced ? 0.04 : 0.12 } }}
            transition={{ duration: reduced ? 0.08 : 0.22, ease: [0.22, 1, 0.36, 1] }}>
            {phase < 3 ? 3 - phase : '정답은…'}
          </motion.span>
        </AnimatePresence>
      </div>
      <p className="reveal-beat" aria-hidden="true">{phase === 3 ? '이제 공개합니다' : '두구두구…'}</p>
      <div className="reveal-progress" aria-hidden="true">
        {[0, 1, 2].map(index => <div key={index}>
          <motion.span initial={{ scaleX: reduced ? 1 : 0 }} animate={{ scaleX: 1 }}
            transition={{ duration: reduced ? 0 : totalMs / 3000, delay: reduced ? 0 : index * totalMs / 3000, ease: 'linear' }} />
        </div>)}
      </div>
      <span className="sr-only">{phase === 3 ? '정답을 공개합니다' : '정답 공개를 준비하고 있습니다'}</span>
    </motion.div>
  </motion.div>}</AnimatePresence>, document.body);
});
