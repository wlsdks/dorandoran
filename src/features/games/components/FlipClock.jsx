import { useState, useEffect, memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/** 한 자리 숫자 카드 — 값이 바뀌면 위에서 새 숫자가 슬라이드로 내려오는 split-flap 풍. */
function FlipDigit({ digit }) {
  return (
    <div
      className="flip-digit relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.7)] ring-1 ring-white/10"
      style={{ width: 'var(--flip-digit-width, clamp(3.2rem, 12vw, 9rem))', height: 'var(--flip-digit-height, clamp(5rem, 19vw, 14rem))' }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={digit}
          initial={{ y: '-105%' }}
          animate={{ y: '0%' }}
          exit={{ y: '105%' }}
          transition={{ type: 'spring', stiffness: 280, damping: 28 }}
          className="absolute inset-0 flex items-center justify-center font-bold tabular-nums text-white leading-none"
          style={{ fontSize: 'var(--flip-digit-font, clamp(3rem, 13vw, 10rem))' }}
        >
          {digit}
        </motion.span>
      </AnimatePresence>
      {/* 중앙 분할선 (플립시계 시그니처) */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-black/45" />
      {/* 상단 광택 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent" />
    </div>
  );
}

function Colon() {
  return (
    <motion.div
      animate={{ opacity: [1, 0.25, 1] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      className="flex flex-col justify-center gap-[clamp(0.6rem,2.5vw,1.6rem)]"
    >
      <span className="rounded-full bg-slate-500" style={{ width: 'clamp(0.5rem,1.6vw,1rem)', height: 'clamp(0.5rem,1.6vw,1rem)' }} />
      <span className="rounded-full bg-slate-500" style={{ width: 'clamp(0.5rem,1.6vw,1rem)', height: 'clamp(0.5rem,1.6vw,1rem)' }} />
    </motion.div>
  );
}

/** 두 자리 숫자 그룹(시/분/초) */
function Pair({ value }) {
  const s = String(value).padStart(2, '0');
  return (
    <div className="flex gap-[clamp(0.3rem,1.2vw,0.75rem)]">
      <FlipDigit digit={s[0]} />
      <FlipDigit digit={s[1]} />
    </div>
  );
}

/**
 * FlipClock — split-flap 풍 대형 시계(전자칠판용).
 * 기본: 현재 시각. values를 주면(예: [분,초] 또는 [시,분,초]) 그 값을 표시 — 카운트다운용.
 * @param {boolean} showSeconds 초 표시 여부(현재시각 모드, 기본 true)
 * @param {number[]} [values]   두 자리 그룹 배열 — 주어지면 내부 시계 대신 이 값 표시
 */
export default memo(function FlipClock({ showSeconds = true, values = null }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (values) return; // 외부 값 모드 — 내부 tick 불필요
    // 초 경계에 맞춰 정렬 후 1초 간격 갱신 — 초가 튀지 않게
    let id;
    const align = setTimeout(() => {
      setNow(new Date());
      id = setInterval(() => setNow(new Date()), 1000);
    }, 1000 - (Date.now() % 1000));
    return () => { clearTimeout(align); clearInterval(id); };
  }, [values]);

  const groups = values ?? [now.getHours(), now.getMinutes(), ...(showSeconds ? [now.getSeconds()] : [])];

  return (
    <div className="flex items-center gap-[clamp(0.5rem,2vw,1.5rem)]">
      {groups.map((v, i) => (
        <span key={i} className="contents">
          {i > 0 && <Colon />}
          <Pair value={v} />
        </span>
      ))}
    </div>
  );
});
