import { useRef, useEffect, useState, useCallback, memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { getServerNow } from '@/features/timer/api/useTimer';

/** 동전이 한 칸을 훑는 시간. 짧으면 긁는 느낌이 안 나고, 길면 아홉 칸이 지루해진다. */
const SWEEP_MS = 620;
/** 동전이 지나간 자리에 벗겨지는 폭(px). 세 번 왕복으로 칸이 거의 덮이는 굵기. */
const COIN_TRACK = 30;
const PASSES = 3;

/** 은박 코팅 — slate 계열 금속 그라데이션. 장식 색 없이 재질감만 준다. */
function paintCoating(canvas) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, width, height);

  const metal = ctx.createLinearGradient(0, 0, width, height);
  metal.addColorStop(0, '#475569');
  metal.addColorStop(0.4, '#94a3b8');
  metal.addColorStop(0.5, '#cbd5e1');
  metal.addColorStop(0.6, '#94a3b8');
  metal.addColorStop(1, '#475569');
  ctx.fillStyle = metal;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 2;
  for (let x = -height; x < width; x += 11) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height, height);
    ctx.stroke();
  }
}

/** 동전 궤적 — 좌우로 세 번 왕복하며 내려간다. 사람이 복권을 긁는 손동작 그대로. */
function pathAt(progress, width, height) {
  const p = Math.min(PASSES - 1e-6, progress * PASSES);
  const pass = Math.floor(p);
  const local = p - pass;
  const direction = pass % 2 === 0 ? local : 1 - local;
  return {
    x: width * (0.08 + 0.84 * direction),
    y: height * (0.22 + 0.28 * pass) + Math.sin(local * Math.PI) * height * 0.04,
  };
}

/**
 * 즉석복권 한 칸.
 *
 * 누르면 동전이 알아서 훑고 지나간다 — 강사가 프로젝터 앞에서 마우스로 문지르고 있을 수는 없다.
 * 긁는 손맛(궤적을 따라 벗겨지는 것)은 남기고 조작만 클릭 한 번으로 줄였다.
 */
export default memo(function ScratchCell({
  primary, secondary, index, revealed, scratching, highlight, interactive = true, presenter, onScratch, onRevealed, startedAt = null,
}) {
  const reduced = useReducedMotion();
  const canvasRef = useRef(null);
  const coinRef = useRef(null);
  const rafRef = useRef(0);
  const timersRef = useRef([]);
  const mountedRef = useRef(true);
  const [sweeping, setSweeping] = useState(false);
  const [swept, setSwept] = useState(false);
  const onRevealedRef = useRef(onRevealed);
  useEffect(() => { onRevealedRef.current = onRevealed; });
  useEffect(() => {
    mountedRef.current = true;
    const timers = timersRef.current;
    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(rafRef.current);
      timers.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || revealed) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    paintCoating(canvas);
  }, [revealed, presenter]);

  const sweep = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = COIN_TRACK;
    setSweeping(true);
    const elapsed = startedAt ? Math.max(0, getServerNow() - startedAt) : 0;
    const start = performance.now() - elapsed;
    let previous = null;
    function reveal() {
      if (!mountedRef.current) return;
      setSwept(true);
      setSweeping(false);
      timersRef.current.push(setTimeout(() => {
        if (mountedRef.current) onRevealedRef.current?.(index);
      }, Math.max(0, (startedAt || getServerNow() - SWEEP_MS) + SWEEP_MS + 220 - getServerNow())));
    }
    if (reduced) {
      timersRef.current.push(setTimeout(reveal, Math.max(0, SWEEP_MS - elapsed)));
      return;
    }
    // 중간 접속은 이미 지나간 동전 경로까지 그려 같은 진행 위치에서 따라간다.
    const completed = Math.min(1, elapsed / SWEEP_MS);
    for (let t = 0; t < completed; t += 0.015) {
      const eased = t * t * (3 - 2 * t);
      const point = pathAt(eased, width, height);
      if (previous) { ctx.beginPath(); ctx.moveTo(previous.x, previous.y); ctx.lineTo(point.x, point.y); ctx.stroke(); }
      previous = point;
    }
    const frame = now => {
      if (!mountedRef.current) return;
      const t = Math.min(1, (now - start) / SWEEP_MS);
      const eased = t * t * (3 - 2 * t);
      const point = pathAt(eased, width, height);
      if (previous) { ctx.beginPath(); ctx.moveTo(previous.x, previous.y); ctx.lineTo(point.x, point.y); ctx.stroke(); }
      previous = point;
      if (coinRef.current) coinRef.current.style.transform = `translate(${point.x * canvas.offsetWidth / width}px, ${point.y * canvas.offsetHeight / height}px) translate(-50%, -50%) rotate(${eased * 540}deg)`;
      if (t < 1) rafRef.current = requestAnimationFrame(frame);
      else reveal();
    };
    rafRef.current = requestAnimationFrame(frame);
  }, [index, startedAt, reduced]);
  useEffect(() => {
    if (scratching && !revealed && !sweeping && !swept) sweep();
  }, [scratching, revealed, sweeping, swept, sweep]);

  const size = presenter ? 'w-[clamp(176px,18vw,340px)] h-[clamp(96px,13dvh,176px)]' : 'w-24 h-20 sm:w-28 sm:h-24';
  const primarySize = presenter ? 'text-[clamp(26px,2.4vw,44px)]' : 'text-base';
  const coinSize = presenter ? 34 : 26;
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, scale: reduced ? 1 : highlight ? 1.025 : 1 }}
    transition={{ duration: 0.18 }} className={`relative ${size} rounded-2xl overflow-hidden ${highlight ? 'bg-white/10' : 'bg-slate-50 dark:bg-slate-800'}`}>
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-2 text-center">
      <span className={`font-bold tracking-tight truncate max-w-full tabular-nums ${primarySize} ${highlight ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>{primary}</span>
      {secondary && <span className={`tabular-nums truncate max-w-full ${presenter ? 'text-[clamp(18px,1.5vw,26px)]' : 'text-[10px]'} ${highlight ? 'text-amber-200' : 'text-slate-400'}`}>{secondary}</span>}
    </div>
    {!revealed && <motion.div className="absolute inset-0" animate={{ opacity: swept ? 0 : 1 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      {interactive && <button onClick={() => onScratch?.(index)} disabled={sweeping} aria-label={`${index + 1}번 칸 긁기`} className="absolute inset-0 w-full h-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-2xl" />}
      {sweeping && reduced && <span className="absolute inset-0 flex items-center justify-center text-slate-900 font-semibold">확인 중</span>}
      {sweeping && !reduced && <div ref={coinRef} aria-hidden="true" className="absolute top-0 left-0 rounded-full pointer-events-none"
        style={{ width: coinSize, height: coinSize, background: 'radial-gradient(circle at 32% 28%, #fef3c7 0%, #fbbf24 42%, #b45309 100%)', boxShadow: '0 3px 8px rgba(0,0,0,0.4), inset 0 0 0 2px rgba(255,255,255,0.35)' }} />}
    </motion.div>}
  </motion.div>;
});
