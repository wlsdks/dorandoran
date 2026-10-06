import { useState, useRef, useEffect, memo, useCallback } from 'react';
import { ref, set, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useHandRaises } from '@/features/hand-raise/api/useHandRaises';
import { motion, AnimatePresence } from 'framer-motion';
import { Hand, X, ChevronDown } from 'lucide-react';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import IconButton from '@/components/ui/IconButton';
import { logger } from '@/lib/logger';

const HandRaiseItem = memo(function HandRaiseItem({ id, nickname, index, onDismiss }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      className="flex items-center justify-between text-sm py-1"
    >
      <span className="text-slate-700 dark:text-slate-200">
        <span className="text-slate-400 mr-2 text-xs">{index + 1}.</span>
        {nickname}
      </span>
      <IconButton icon={X} size="sm" variant="danger" label="해제" onClick={() => onDismiss(id)} />
    </motion.div>
  );
});

export default function HandRaiseList({ sessionId, embedded = false }) {
  const { raisedList, count } = useHandRaises(sessionId);
  const [collapsed, setCollapsed] = useState(false);

  // Shake animation on new hand raise arrival
  const prevCountRef = useRef(count);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (count > prevCountRef.current) {
      setShake(true);
      setTimeout(() => setShake(false), 600);
    }
    prevCountRef.current = count;
  }, [count]);

  const dismissOne = useCallback(async (participantId) => {
    try {
      await set(ref(db, `sessions/${sessionId}/handRaises/${participantId}/raised`), false);
    } catch (err) {
      logger.error('손들기 해제 실패:', err);
    }
  }, [sessionId]);

  async function dismissAll() {
    try {
      const updates = {};
      raisedList.forEach(p => {
        updates[`sessions/${sessionId}/handRaises/${p.id}/raised`] = false;
      });
      await update(ref(db), updates);
    } catch (err) {
      logger.error('전체 손들기 해제 실패:', err);
    }
  }

  const body = (
    <div className={embedded ? 'space-y-1.5' : 'px-3.5 pb-3 space-y-1.5'}>
      {count > 0 && (
        <div className="flex justify-end">
          <button
            onClick={(e) => { e.stopPropagation(); dismissAll(); }}
            aria-label="모든 손들기 해제"
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors duration-150"
          >
            전체 해제
          </button>
        </div>
      )}
      {count === 0 && (
        <div className="flex items-center gap-2 py-1">
          <DoranDoranMascot size="xs" />
          <p className="text-slate-400 text-xs">손든 학생이 없습니다</p>
        </div>
      )}
      <AnimatePresence>
        {raisedList.map((p, i) => (
          <HandRaiseItem key={p.id} id={p.id} nickname={p.nickname} index={i} onDismiss={dismissOne} />
        ))}
      </AnimatePresence>
    </div>
  );

  if (embedded) return body;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <motion.button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600 transition-colors duration-150"
        animate={shake ? { x: [0, -4, 4, -3, 3, -1, 1, 0] } : { x: 0 }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
      >
        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
          <Hand size={14} className="text-slate-400" />
          손들기
          {count > 0 && (
            <motion.span
              key={count}
              initial={{ scale: 1.3 }}
              animate={{ scale: 1 }}
              className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-slate-900 text-white text-[10px] font-bold"
            >
              {count}
            </motion.span>
          )}
        </span>
        <motion.div animate={{ rotate: collapsed ? 0 : 180 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={14} className="text-slate-400" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {body}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
