import { useEffect, useState, useRef } from 'react';
import { ref, onChildAdded } from 'firebase/database';
import { db } from '@/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { slideInRight, settle } from '@/lib/motion';
import Avatar from '@/components/ui/Avatar';
import { ROSTER_SOURCE } from '@/lib/roster';
import { abortableDelay } from '@/lib/async-work';

const MAX_VISIBLE = 5;
const DISPLAY_MS = 400;
const BATCH_PAUSE_MS = 300;
const MAX_QUEUE = 50;

export default function JoinToast({ sessionId }) {
  const [visible, setVisible] = useState([]);
  const queueRef = useRef([]);

  // 큐에서 5명씩 꺼내서 하나씩 아래로 추가 → 다 차면 클리어 → 반복
  async function drainQueue(job) {
    if (job.running) return;
    job.running = true;
    const signal = job.controller.signal;
    try {

    while (!signal.aborted && queueRef.current.length > 0) {
      // 5명 한 배치
      const batch = queueRef.current.splice(0, MAX_VISIBLE);
      setVisible([]);
      await abortableDelay(100, signal);

      for (let i = 0; i < batch.length; i++) {
        if (signal.aborted) break;
        setVisible(prev => [...prev, { sessionId, nickname: batch[i], id: Date.now() + Math.random() }]);
        await abortableDelay(DISPLAY_MS, signal);
      }

      // 배치 표시 후 잠깐 유지 → 클리어
      await abortableDelay(BATCH_PAUSE_MS, signal);
      if (signal.aborted) break;
      setVisible([]);
      await abortableDelay(150, signal);
    }

    } catch (error) { if (!signal.aborted) throw error; }
    finally { job.running = false; }
  }

  useEffect(() => {
    if (!sessionId) return;
    const job = { controller: new AbortController(), running: false };
    queueRef.current = [];
    const participantsRef = ref(db, `sessions/${sessionId}/participants`);
    let initial = true;

    const unsub = onChildAdded(participantsRef, (snapshot) => {
      if (initial) return;
      const data = snapshot.val();
      if (!data?.nickname) return;
      // 강사가 명단에 직접 넣은 사람은 입장한 것이 아니다. 붙여넣기 한 번에 수십 명이
      // "입장했어요"로 쏟아지면 사실과도 다르고 화면도 뒤덮인다.
      if (data.source === ROSTER_SOURCE) return;

      if (queueRef.current.length >= MAX_QUEUE) queueRef.current.splice(0, 10);
      queueRef.current.push(data.nickname);
      drainQueue(job).catch(() => {});
    });

    const initTimer = setTimeout(() => { initial = false; }, 2000);
    return () => { job.controller.abort(); unsub(); clearTimeout(initTimer); queueRef.current = []; };
    // drainQueue는 같은 컴포넌트 inline 함수 + ref-based이라 stale closure 영향 없음
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return (
    <div className="fixed top-20 right-4 z-30 flex flex-col items-end gap-2 pointer-events-none" role="log" aria-label="참여자 알림" aria-live="polite">
      <AnimatePresence>
        {visible.filter(item => item.sessionId === sessionId).map((item) => (
          <motion.div
            key={item.id}
            layout="position"
            {...slideInRight}
            transition={{ ...slideInRight.transition, layout: settle }}
            className="flex items-center gap-2.5 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md shadow-lg ring-1 ring-slate-900/5 dark:ring-white/10 pl-2 pr-4 py-2 rounded-full whitespace-nowrap"
          >
            <div className="relative shrink-0">
              <Avatar name={item.nickname} size="sm" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-800" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.nickname}</span>
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">입장했어요</span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
