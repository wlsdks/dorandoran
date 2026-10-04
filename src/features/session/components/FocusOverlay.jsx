import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { ref, set, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { Eye, Hand } from 'lucide-react';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import { useMyHandRaise } from '@/features/hand-raise/api/useHandRaises';
import { getParticipantId, getNickname } from '@/lib/participant';

/**
 * FocusOverlay — 강사가 "집중" 모드 트리거 시 학생 화면에 표시.
 * 어두운 배경 + "강사를 봐주세요" 메시지. 리액션/채팅은 비활성하되,
 * 최소한의 '손들기'는 유지 — 집중 설명 중 이해 안 되는 학생의 유일한 소통 창구.
 */
export default memo(function FocusOverlay({ sessionId }) {
  const { raised } = useMyHandRaise(sessionId);
  const [busy, setBusy] = useState(false);

  async function toggleHand() {
    if (!sessionId || busy) return;
    setBusy(true);
    try {
      const pid = getParticipantId();
      await set(ref(db, `sessions/${sessionId}/handRaises/${pid}`), raised
        ? { nickname: getNickname() || '익명', raised: false, raisedAt: null }
        : { nickname: getNickname() || '익명', raised: true, raisedAt: serverTimestamp() });
    } catch (err) { logger.error('Focus hand toggle failed:', err); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-dvh bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="space-y-6"
      >
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <DoranDoranMascot size="lg" mood="happy" />
        </motion.div>

        <div className="space-y-3">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 25 }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 rounded-full"
          >
            <Eye size={18} className="text-white/80" />
            <span className="text-white/90 font-bold text-lg tracking-tight">집중!</span>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="text-white/60 text-[15px] leading-relaxed"
          >
            강사의 설명에 집중해주세요
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ delay: 0.5, duration: 2, repeat: Infinity }}
            className="flex justify-center gap-1 pt-2"
          >
            {[0, 1, 2].map(i => (
              <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/40" />
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* 최소 손들기 — 집중 모드에서도 도움 요청 창구 유지 */}
      {sessionId && (
        <motion.button
          onClick={toggleHand}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          whileTap={{ scale: 0.94 }}
          aria-pressed={raised}
          aria-label={raised ? '손 내리기' : '손들기'}
          className={`fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold text-sm shadow-lg transition-colors duration-150 ${
            raised ? 'bg-amber-400 text-slate-900' : 'bg-white/10 text-white/85 hover:bg-white/20'
          }`}
        >
          <Hand size={18} className={raised ? 'animate-bounce' : ''} />
          {raised ? '손 든 상태 · 내리기' : '손들기'}
        </motion.button>
      )}
    </div>
  );
});
