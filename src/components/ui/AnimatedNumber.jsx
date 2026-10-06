import { useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { count } from '@/lib/motion';

/** 첫 값은 정확히 표시하고, 이후 변화는 현재 표시 값에서 부드럽게 이어간다. */
export default function AnimatedNumber({ value, className = '' }) {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const displayed = useMotionValue(value);
  const rounded = useTransform(displayed, number => Math.round(number));
  useEffect(() => {
    const control = animate(displayed, value, { duration: reduced ? 0 : count.number.duration, ease: count.number.ease });
    return () => control.stop();
  }, [displayed, value, reduced]);
  return <motion.span className={className}>{rounded}</motion.span>;
}
