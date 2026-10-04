import { motion } from 'framer-motion';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { motion as motionTokens } from '@/lib/design-tokens';

/** 함께 수업을 마친 도란·두런의 인사. */
export default function CelebrationMascot() {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reducedMotion ? 0 : motionTokens.duration.enter, ease: motionTokens.ease.out }}
    >
      <DoranDoranMascot size={96} mood="happy" />
    </motion.div>
  );
}
