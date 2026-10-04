import { memo, useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const PARTICLE_COUNT = 24;
const COLORS = ['#475569', '#6366F1', '#818CF8', '#94A3B8', '#CBD5E1', '#E2E8F0'];
const MAX_DURATION = 1.4;

function seededRandom(seed) {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

function createParticle(index) {
  const s1 = seededRandom(index + 1);
  const s2 = seededRandom(index + 17);
  const s3 = seededRandom(index + 37);
  const s4 = seededRandom(index + 53);
  const s5 = seededRandom(index + 71);

  const baseAngle = (index / PARTICLE_COUNT) * 360;
  const angle = baseAngle + (s1 - 0.5) * 40;
  const rad = (angle * Math.PI) / 180;
  const distance = 80 + s2 * 150;

  return {
    id: index,
    x: Math.cos(rad) * distance,
    y: Math.sin(rad) * distance,
    rotate: s3 * 540 - 270,
    scale: 0.7 + s4 * 0.7,
    color: COLORS[Math.floor(s5 * COLORS.length)],
    shape: Math.floor(s1 * 3), // 0=circle, 1=rect, 2=diamond
    delay: s2 * 0.08,
    duration: 0.7 + s3 * 0.4,
  };
}

function ParticleShape({ shape, color, size }) {
  if (shape === 0) {
    return <circle cx={size / 2} cy={size / 2} r={size / 2} fill={color} />;
  }
  if (shape === 1) {
    return <rect width={size} height={size * 0.55} rx={1} fill={color} />;
  }
  const half = size / 2;
  return (
    <polygon
      points={`${half},0 ${size},${half} ${half},${size} 0,${half}`}
      fill={color}
    />
  );
}

const Particle = memo(function Particle({ particle }) {
  const size = 8 * particle.scale;

  return (
    <motion.div
      initial={{ opacity: 1, x: 0, y: 0, scale: 0, rotate: 0 }}
      animate={{
        opacity: [1, 1, 0],
        x: particle.x,
        y: particle.y,
        scale: [0, 1.4, 0.4],
        rotate: particle.rotate,
      }}
      transition={{
        duration: particle.duration,
        delay: 0.1 + particle.delay,
        ease: [0.12, 0.7, 0.3, 1],
        times: [0, 0.3, 1],
      }}
      className="absolute"
      style={{ left: '50%', top: '22%', marginLeft: -size / 2, marginTop: -size / 2 }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <ParticleShape shape={particle.shape} color={particle.color} size={size} />
      </svg>
    </motion.div>
  );
});

/**
 * Confetti burst animation for quiz correct answers.
 * Pure Framer Motion + SVG, no external dependencies.
 * Particles burst from center of the card, spread outward, then fade.
 * Auto-unmounts after animation completes to keep DOM clean.
 */
export default memo(function ConfettiBurst() {
  const [visible, setVisible] = useState(true);
  const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const particles = useMemo(
    () => prefersReduced ? [] : Array.from({ length: PARTICLE_COUNT }, (_, i) => createParticle(i)),
    [prefersReduced],
  );

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), MAX_DURATION * 1000 + 300);
    return () => clearTimeout(timer);
  }, []);

  if (!visible || prefersReduced) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-10 overflow-clip"
      aria-hidden="true"
    >
      {particles.map((p) => (
        <Particle key={p.id} particle={p} />
      ))}
    </div>
  );
});
