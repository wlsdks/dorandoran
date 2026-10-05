import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Sparkle, Flame, CheckCheck, Zap, Crown, X } from 'lucide-react';

const ICON_MAP = { Sparkle, Flame, CheckCheck, Zap, Crown };
const DISPLAY_DURATION = 3000;
const EMPTY_ACHIEVEMENTS = [];

function storedIds(key) {
  try {
    const ids = JSON.parse(sessionStorage.getItem(key) || '[]');
    return new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : []);
  } catch { return new Set(); }
}
function persistIds(controller) {
  try { sessionStorage.setItem(controller.scope, JSON.stringify([...controller.seen])); } catch { /* This mount still remembers its baseline. */ }
}
function cancelTimer(controller) {
  if (controller.timer !== null) clearTimeout(controller.timer);
  controller.timer = null;
}
function advance(controller, publish) {
  cancelTimer(controller);
  const now = Date.now();
  if (controller.active && controller.active.expiresAt <= now) controller.active = null;
  if (!controller.active && controller.queue.length) {
    controller.active = { achievement: controller.queue.shift(), scope: controller.scope, expiresAt: now + DISPLAY_DURATION };
  }
  publish(controller.active);
  if (controller.active) {
    controller.timer = setTimeout(() => {
      controller.timer = null;
      advance(controller, publish);
    }, Math.max(0, controller.active.expiresAt - Date.now()));
  }
}

/** Session/learner-scoped, read-only achievement feedback. Existing achievements establish a silent ready baseline. */
export default function AchievementToast({ achievements = EMPTY_ACHIEVEMENTS, sessionId, participantId, ready = false }) {
  const scope = sessionId && participantId ? `dorandoran_achievement_seen:${JSON.stringify([sessionId, participantId])}` : null;
  const [visible, setVisible] = useState(null);
  const controllerRef = useRef({ scope: null, seen: new Set(), queue: [], active: null, timer: null, baselined: false });
  const reduced = useReducedMotion();

  useEffect(() => {
    const controller = controllerRef.current;
    cancelTimer(controller);
    if (controller.scope !== scope) {
      controller.scope = scope;
      controller.seen = scope ? storedIds(scope) : new Set();
      controller.queue = [];
      controller.active = null;
      controller.baselined = false;
    }
    if (ready && scope) {
      if (!controller.baselined) {
        achievements.forEach((achievement) => controller.seen.add(achievement.id));
        controller.baselined = true;
        persistIds(controller);
      } else {
        achievements.forEach((achievement) => {
          if (!achievement?.id || controller.seen.has(achievement.id)) return;
          controller.seen.add(achievement.id);
          controller.queue.push(achievement);
        });
        persistIds(controller);
      }
      // StrictMode, fresh array props, and Fast Refresh cancel/restart the timer;
      // the active absolute expiry is retained, so its 3s deadline never moves.
      advance(controller, setVisible);
    }
    return () => cancelTimer(controller);
  }, [achievements, ready, scope]);

  const dismiss = useCallback(() => {
    const controller = controllerRef.current;
    controller.active = null;
    advance(controller, setVisible);
  }, []);
  if (typeof document === 'undefined') return null;
  const current = ready && visible?.scope === scope ? visible.achievement : null;
  const Icon = current ? ICON_MAP[current.icon] || Sparkle : Sparkle;
  return createPortal(
    <AnimatePresence key={scope}>
      {current && <motion.div key={current.id} role="status" aria-live="polite" data-achievement-id={current.id}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.14 }}
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] inset-x-4 max-w-[320px] mx-auto z-40 flex items-center gap-2 pl-3 pr-1 rounded-xl bg-slate-800 dark:bg-slate-700 text-slate-100 shadow-lg ring-1 ring-slate-600/50">
        <Icon size={18} className="shrink-0 text-indigo-300" aria-hidden="true" />
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{current.label}</p>
        <button type="button" onClick={dismiss} aria-label="업적 알림 닫기" className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl text-slate-300 hover:bg-slate-600/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"><X size={18} /></button>
      </motion.div>}
    </AnimatePresence>, document.body
  );
}
