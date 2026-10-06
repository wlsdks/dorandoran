import { useState, useEffect } from 'react';
import { ref, set, update, onValue, remove, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import Button from '@/components/ui/Button';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import { getServerNow } from '@/features/timer/api/useTimer';

const PRESETS = [
  { label: '1분', seconds: 60 },
  { label: '2분', seconds: 120 },
  { label: '3분', seconds: 180 },
  { label: '5분', seconds: 300 },
];

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function DiscussionPresenter({ sessionId, readOnly = false, presenter = false }) {
  const [discussion, setDiscussion] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [topic, setTopic] = useState('');
  const [selectedDuration, setSelectedDuration] = useState(180);

  useEffect(() => {
    const discRef = ref(db, `sessions/${sessionId}/discussion`);
    const unsub = onValue(discRef, snap => setDiscussion(snap.val()), () => {});
    return () => unsub();
  }, [sessionId]);

  useEffect(() => {
    if (!discussion?.endTime) { setRemaining(0); return; }
    function tick() {
      setRemaining(Math.max(0, Math.ceil((discussion.endTime - getServerNow()) / 1000)));
    }
    tick();
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [discussion?.endTime]);

  async function startDiscussion() {
    if (readOnly) return;
    const endTime = getServerNow() + selectedDuration * 1000;
    await set(ref(db, `sessions/${sessionId}/discussion`), {
      topic: topic.trim() || null,
      duration: selectedDuration,
      endTime,
      startedAt: serverTimestamp(),
    });
  }

  // 진행 중 조정 — 지금 끝내기(종료 시각을 현재로) / 1분 연장
  async function endNow() {
    if (readOnly) return;
    await update(ref(db, `sessions/${sessionId}/discussion`), { endTime: getServerNow() });
  }
  async function extendOneMinute() {
    if (readOnly || !discussion?.endTime) return;
    await update(ref(db, `sessions/${sessionId}/discussion`), {
      endTime: Math.max(discussion.endTime, getServerNow()) + 60000,
      duration: (discussion.duration || 0) + 60,
    });
  }

  async function resetDiscussion() {
    if (readOnly) return;
    await remove(ref(db, `sessions/${sessionId}/discussion`));
  }

  const isFinished = discussion?.endTime && remaining === 0;
  const memos = discussion?.memos ? Object.values(discussion.memos) : [];
  const progress = discussion?.duration > 0 ? remaining / discussion.duration : 0;
  const isUrgent = remaining <= 10 && remaining > 0;

  const [memoPage, setMemoPage] = useState(0);
  const memoPageSize = memos.some(memo => (memo.text || '').length > 160) ? 1 : 3;
  const memoPages = Math.max(1, Math.ceil(memos.length / memoPageSize));
  useEffect(() => {
    if (!presenter || !isFinished || memoPages < 2) return;
    const timer = setInterval(() => setMemoPage(page => (page + 1) % memoPages), 12000);
    return () => clearInterval(timer);
  }, [presenter, isFinished, memoPages]);

  // Setup view
  if (!discussion?.endTime) {
    if (readOnly) return <div className="paper-surface max-w-[1100px] text-center space-y-6 py-10">
      <DoranDoranMascot size="lg" mood="waiting" />
      <h3 className="classroom-question-title font-bold">함께 이야기할 준비를 해주세요</h3>
      <p className="text-2xl text-slate-300">강사가 토론을 시작하면 주제와 남은 시간이 표시됩니다</p>
    </div>;
    return (
      <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">그룹 토론</h3>
        <input
          type="text"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="토론 주제 (선택)"
          maxLength={100}
          className="w-full bg-white dark:bg-slate-800 rounded-xl px-4 py-3.5 text-[16px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm transition-colors"
        />
        <div className="flex gap-3">
          {PRESETS.map(p => (
            <motion.button
              key={p.seconds}
              whileTap={{ scale: 0.93 }}
              onClick={() => setSelectedDuration(p.seconds)}
              className={`px-5 py-3 rounded-full font-bold text-base transition-colors duration-150 ${
                selectedDuration === p.seconds
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm'
              }`}
            >
              {p.label}
            </motion.button>
          ))}
        </div>
        <Button onClick={startDiscussion} variant="primary" size="lg" className="w-full">
          <Play size={18} /> 토론 시작
        </Button>
      </div>
    );
  }

  // Active / finished view
  const sortedMemos = [...memos].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  return (
    <div className={`flex flex-col items-center gap-6 w-full mx-auto ${presenter ? "paper-surface max-w-[1100px]" : "max-w-2xl"}`} onClick={e => e.stopPropagation()}>
      {discussion.topic && (
        <p className={`${presenter ? "text-3xl md:text-4xl text-slate-200" : "text-lg text-slate-500 dark:text-slate-400"} text-center leading-snug break-keep`}>{discussion.topic}</p>
      )}

      <motion.div
        animate={isUrgent ? { scale: [1, 1.03, 1] } : {}}
        transition={isUrgent ? { repeat: Infinity, duration: 0.5 } : {}}
      >
        <p className={`text-7xl md:text-8xl font-bold tabular-nums tracking-tight ${
          isFinished ? 'text-slate-300 dark:text-slate-600' : isUrgent ? 'text-red-500' : 'text-slate-900 dark:text-slate-100'
        }`}>{formatTime(remaining)}</p>
      </motion.div>

      <div className="w-full max-w-sm h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${isUrgent ? 'bg-red-500' : 'bg-indigo-500'}`}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {isFinished && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2"
        >
          <p className={`${presenter ? "text-3xl" : "text-xl"} font-bold text-slate-900 dark:text-slate-100 tracking-tight`}>토론 종료!</p>
          <p className={presenter ? "text-2xl text-slate-300" : "text-slate-400"}>{memos.length}개 메모 수집됨</p>
        </motion.div>
      )}

      {/* Collected memos */}
      {memos.length > 0 && isFinished && (
        <div className={`w-full grid gap-3 ${presenter ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 max-h-[300px] overflow-y-auto"}`}>
          {(presenter ? sortedMemos.slice((memoPage % memoPages) * memoPageSize, (memoPage % memoPages) * memoPageSize + memoPageSize) : sortedMemos).map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-3"
            >
              <p className={`${presenter ? "text-2xl" : "text-sm"} text-slate-700 dark:text-slate-200 leading-relaxed break-words`}>{m.text}</p>
              <p className={`${presenter ? "text-lg text-slate-300" : "text-xs text-slate-400"} mt-1`}>{m.nickname}</p>
            </motion.div>
          ))}
        </div>
      )}

      {presenter && isFinished && memoPages > 1 && <p className="text-lg text-slate-300">메모 {(memoPage % memoPages) + 1} / {memoPages} · 12초마다 다음 메모</p>}
      {!isFinished && discussion?.endTime && !readOnly && !presenter && (
        <div className="flex gap-2">
          <Button onClick={extendOneMinute} variant="secondary" size="md">1분 연장</Button>
          <Button onClick={endNow} variant="secondary" size="md">지금 끝내기</Button>
        </div>
      )}
      {isFinished && !readOnly && (
        <Button onClick={resetDiscussion} variant="secondary" size="md">새 토론</Button>
      )}
    </div>
  );
}
