import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkle, Flame, CheckCheck, Zap, Crown } from 'lucide-react';

const ICON_MAP = {
  Sparkle,
  Flame,
  CheckCheck,
  Zap,
  Crown,
};

const DISPLAY_DURATION = 3500;

/**
 * AchievementToast — shows a small toast when a new achievement is earned.
 * Tracks previously shown achievements and only shows new ones.
 * Now with icon spin animation and timer progress bar.
 *
 * @param {{ achievements: Array<{id, label, description, icon}> }} props
 */
export default function AchievementToast({ achievements }) {
  const [visible, setVisible] = useState(null);
  const shownRef = useRef(new Set());
  const queueRef = useRef([]);
  const timerRef = useRef(null);

  function showNext() {
    const next = queueRef.current.shift();
    if (!next) {
      timerRef.current = null;
      return;
    }
    setVisible(next);
    timerRef.current = setTimeout(() => {
      setVisible(null);
      timerRef.current = setTimeout(showNext, 300);
    }, DISPLAY_DURATION);
  }

  useEffect(() => {
    const newOnes = achievements.filter((a) => !shownRef.current.has(a.id));
    if (newOnes.length === 0) return;

    newOnes.forEach((a) => {
      shownRef.current.add(a.id);
      queueRef.current.push(a);
    });

    if (!timerRef.current) showNext();
    // showNext는 같은 컴포넌트 함수 + recursive trigger (timerRef로 self-driven)이라 의도적 omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [achievements]);


  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const Icon = visible ? (ICON_MAP[visible.icon] || Sparkle) : null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={visible.id}
          role="status"
          initial={{ opacity: 0, y: -8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed top-[calc(5rem+env(safe-area-inset-top))] inset-x-4 max-w-sm mx-auto z-30 pointer-events-none"
        >
          <div className="relative overflow-hidden bg-slate-900 text-white rounded-xl shadow-2xl shadow-black/40 ring-1 ring-white/15">
            <div className="flex items-center gap-3 pl-3 pr-5 py-2.5">
              {/* Animated icon */}
              <motion.div
                className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0"
                initial={{ rotate: -90, scale: 0.5 }}
                animate={{ rotate: 0, scale: [1, 1.15, 1] }}
                transition={{
                  rotate: { type: 'spring', stiffness: 300, damping: 25 },
                  scale: { duration: 0.6, delay: 0.2, times: [0, 0.5, 1] },
                }}
              >
                <Icon size={16} className="text-white" />
              </motion.div>
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight">{visible.label}</p>
                <p className="text-xs text-slate-300 leading-tight mt-0.5">{visible.description}</p>
              </div>
            </div>
            {/* Timer progress bar */}
            <motion.div
              className="absolute bottom-0 left-0 h-[2px] bg-white/25"
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: DISPLAY_DURATION / 1000, ease: 'linear' }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
