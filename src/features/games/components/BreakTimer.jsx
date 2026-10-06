import { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ref, onValue, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { getServerNow } from '@/features/timer/api/useTimer';
import BreakMascot from './BreakMascot';
import FlipClock from './FlipClock';
import Button from '@/components/ui/Button';
import './LargeDisplayGames.css';

const PRESETS = [
  { label: '5분', seconds: 300 },
  { label: '10분', seconds: 600 },
  { label: '15분', seconds: 900 },
  { label: '20분', seconds: 1200 },
];

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/**
 * BreakTimer — 쉬는시간 화면(전자칠판/발표모드 공용).
 * 기본은 현재 시각 플립시계. 프리셋(5/10/15/20분)을 누르면 세션 breakEndsAt으로
 * '동기화된' 카운트다운이 메인 플립시계 자리에서 −1초씩 흐르고, 0이 되면 종료 상태.
 * 기존 로컬 state 방식은 발표모드에서 눌러도 전자칠판에 안 보였음 — 세션 동기로 교체.
 */
export default function BreakTimer({ sessionId, readOnly = false, presenter = false }) {
  const reduced = useReducedMotion();
  const [endsAt, setEndsAt] = useState(null);      // 세션 동기: 종료 시각(ms)
  const [duration, setDuration] = useState(null);  // 세션 동기: 총 길이(s) — 진행바용
  const [nowTick, setNowTick] = useState(() => getServerNow());

  // 세션 구독 — 어느 화면(발표/전자칠판)에서 시작해도 모두 동일 카운트다운
  useEffect(() => {
    if (!sessionId) return;
    const u1 = onValue(ref(db, `sessions/${sessionId}/breakEndsAt`), (s) => {
      setEndsAt(s.val());
      setNowTick(getServerNow());
    });
    const u2 = onValue(ref(db, `sessions/${sessionId}/breakDuration`), (s) => setDuration(s.val()));
    return () => { u1(); u2(); };
  }, [sessionId]);

  // 1초 tick (초 경계 정렬) — 카운트다운 중에만
  useEffect(() => {
    if (!endsAt) return;
    let id;
    const align = setTimeout(() => {
      setNowTick(getServerNow());
      id = setInterval(() => setNowTick(getServerNow()), 1000);
    }, 1000 - (Date.now() % 1000));
    return () => { clearTimeout(align); clearInterval(id); };
  }, [endsAt]);

  const remaining = endsAt ? Math.max(0, Math.ceil((endsAt - nowTick) / 1000)) : null;
  const running = endsAt && remaining > 0;
  const isFinished = endsAt && remaining === 0;
  const progress = running && duration ? remaining / duration : 0;

  function start(seconds) {
    if (readOnly) return;
    update(ref(db, `sessions/${sessionId}`), {
      breakEndsAt: getServerNow() + seconds * 1000,
      breakDuration: seconds,
    }).catch(() => {});
  }
  function stop() {
    if (readOnly) return;
    update(ref(db, `sessions/${sessionId}`), { breakEndsAt: null, breakDuration: null }).catch(() => {});
  }

  // 플립 표시값: 카운트다운(1시간 미만 MM:SS, 이상 HH:MM:SS) 또는 현재 시각
  const countdownValues = running || isFinished
    ? (duration >= 3600
        ? [Math.floor(remaining / 3600), Math.floor((remaining % 3600) / 60), remaining % 60]
        : [Math.floor(remaining / 60), remaining % 60])
    : null;

  return (
    <div data-presenter={presenter} className={`break-timer-stage flex flex-col items-center gap-8 md:gap-10 w-full ${presenter ? "max-w-[1200px] mx-auto" : ""}`} onClick={(e) => e.stopPropagation()}>
      {/* 라벨 + 마스코트 */}
      <motion.div
        initial={{ opacity: 0, y: reduced ? 0 : -8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="flex items-center gap-3"
      >
        <BreakMascot size={64} />
        <div className="text-left">
          <p className={`break-timer-title ${presenter ? "text-3xl md:text-4xl" : "text-2xl md:text-3xl"} font-bold tracking-tight text-slate-900 dark:text-slate-100`}>
            {isFinished ? '쉬는 시간 끝!' : '쉬는 시간'}
          </p>
          <p className={`break-timer-caption ${presenter ? "text-2xl text-slate-600 dark:text-slate-300" : "text-sm text-slate-600 dark:text-slate-400"}`}>
            {isFinished ? '이제 수업을 다시 시작할게요'
              : running ? `${formatTime(remaining)} 후 수업을 이어갑니다`
              : '잠시 후 수업을 이어갑니다'}
          </p>
        </div>
      </motion.div>

      {/* 메인 플립시계 — 카운트다운 중엔 남은 시간이 주인공, 평시엔 현재 시각 */}
      <motion.div
        initial={{ opacity: 0, scale: reduced ? 1 : 0.94 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26, delay: 0.05 }}
        className={`break-clock-display ${isFinished && !reduced ? 'animate-pulse' : ''}`}
      >
        <FlipClock key={countdownValues ? 'countdown' : 'clock'} showSeconds values={countdownValues} />
      </motion.div>

      {/* 컨트롤 영역 */}
      {!readOnly && (isFinished ? (
        <Button onClick={stop} variant="primary" size="lg">현재 시각으로 돌아가기</Button>
      ) : running ? (
        <div className="flex flex-col items-center gap-3 w-full max-w-md">
          <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-indigo-500 dark:bg-indigo-400 rounded-full"
              animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.5 }}
            />
          </div>
          <Button onClick={stop} variant="ghost" size="sm">타이머 끄기</Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 dark:text-slate-500 mr-1">타이머</span>
          {PRESETS.map((p, i) => (
            <motion.button
              key={p.seconds}
              initial={{ opacity: 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.04 }}
              whileTap={{ scale: reduced ? 1 : 0.93 }}
              onClick={() => start(p.seconds)}
              className="px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors duration-150"
            >
              {p.label}
            </motion.button>
          ))}
        </div>
      ))}
    </div>
  );
}
