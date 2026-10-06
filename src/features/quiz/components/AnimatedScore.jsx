import { useEffect, useRef } from 'react';
import { useMotionValue, useTransform, animate } from 'framer-motion';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { count } from '@/lib/motion';

/** 점수 카운터 — 이전 값에서 새 값으로 이어 센다(공용 count.score 곡선, 감속 모션이면 즉시). */
export default function AnimatedScore({ value, suffix = '점' }) {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const motionVal = useMotionValue(0);
  const rounded = useTransform(motionVal, (v) => Math.round(v));
  const displayRef = useRef(null);
  const prevValueRef = useRef(value);

  useEffect(() => {
    const from = prevValueRef.current;
    prevValueRef.current = value;

    const unsubscribe = rounded.on('change', (v) => {
      if (displayRef.current) displayRef.current.textContent = `${v}${suffix}`;
    });
    const controls = animate(motionVal, value, {
      from,
      duration: reduced ? 0 : count.score.duration,
      ease: count.score.ease,
    });
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [value, motionVal, rounded, suffix, reduced]);

  return <span ref={displayRef} className="tabular-nums">{value}{suffix}</span>;
}
