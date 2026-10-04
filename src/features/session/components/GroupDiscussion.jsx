import { useState, useEffect, memo } from 'react';
import { ref, onValue, push, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { getParticipantId, getNickname } from '@/lib/participant';
import { motion } from 'framer-motion';
import { MessageSquare, Send } from 'lucide-react';
import Button from '@/components/ui/Button';
import { hapticTap } from '@/lib/haptics';

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** Student view — timer + memo input */
function StudentDiscussion({ sessionId, embedded = false }) {
  const [discussion, setDiscussion] = useState(null);
  const [memo, setMemo] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const pid = getParticipantId();
  const nickname = getNickname() || '참여자';

  useEffect(() => {
    const discRef = ref(db, `sessions/${sessionId}/discussion`);
    const unsub = onValue(discRef, snap => setDiscussion(snap.val()), () => {});
    return () => unsub();
  }, [sessionId]);

  useEffect(() => {
    if (!discussion?.endTime) { setRemaining(0); return; }
    function tick() {
      const left = Math.max(0, Math.ceil((discussion.endTime - Date.now()) / 1000));
      setRemaining(left);
    }
    tick();
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [discussion?.endTime]);

  async function handleSubmit(e) {
    e?.preventDefault();
    if (!memo.trim()) return;
    hapticTap();
    await push(ref(db, `sessions/${sessionId}/discussion/memos`), {
      text: memo.trim(),
      nickname,
      pid,
      timestamp: serverTimestamp(),
    });
    setMemo('');
    setSubmitted(true);
  }

  const isFinished = discussion?.endTime && remaining === 0;
  const progress = discussion?.duration > 0 ? remaining / discussion.duration : 0;
  const isUrgent = remaining <= 10 && remaining > 0;

  if (!discussion?.endTime) {
    return (
      <div className={`${embedded ? "min-h-[50dvh]" : "min-h-dvh p-6"} bg-slate-50 dark:bg-slate-900 flex items-center justify-center`}>
        <div className="text-center space-y-3">
          <MessageSquare size={28} className="mx-auto text-slate-300" />
          <p className="text-slate-400 text-[15px]">토론이 곧 시작됩니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${embedded ? "min-h-[50dvh]" : "min-h-dvh p-5 pt-6"} bg-slate-50 dark:bg-slate-900 flex flex-col`}>
      {/* Topic */}
      {discussion.topic && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 mb-4"
        >
          <p className="text-xs font-semibold text-slate-400 mb-1">토론 주제</p>
          <p className="text-[16px] font-medium text-slate-900 dark:text-slate-100 leading-relaxed">{discussion.topic}</p>
        </motion.div>
      )}

      {/* Timer */}
      <motion.div
        animate={isUrgent ? { scale: [1, 1.02, 1] } : {}}
        transition={isUrgent ? { repeat: Infinity, duration: 0.6 } : {}}
        className="text-center mb-6"
      >
        <p className={`text-5xl font-bold tabular-nums tracking-tight ${
          isFinished ? 'text-slate-300 dark:text-slate-600' : isUrgent ? 'text-red-500' : 'text-slate-900 dark:text-slate-100'
        }`}>{formatTime(remaining)}</p>
        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-3 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${isUrgent ? 'bg-red-500' : 'bg-indigo-500'}`}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </motion.div>

      {/* Memo input */}
      <div className="flex-1 flex flex-col">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">토론 메모</p>
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-3">
          <textarea
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="토론 내용을 메모하세요..."
            rows={4}
            maxLength={500}
            className="flex-1 bg-white dark:bg-slate-800 rounded-xl px-4 py-3.5 text-[16px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm resize-none transition-colors"
          />
          <Button type="submit" variant="primary" size="lg" disabled={!memo.trim()} className="w-full">
            <Send size={16} /> 메모 제출
          </Button>
        </form>
        {submitted && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-slate-400 text-center mt-2">
            메모가 제출되었습니다. 추가 메모를 보낼 수 있어요.
          </motion.p>
        )}
      </div>
    </div>
  );
}

export default memo(StudentDiscussion);
