import { useMemo } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { createDoranDoranSvg } from '@/lib/dorandoran-art';

const SIZES = { xs: 36, sm: 48, md: 80, lg: 120 };
const MOODS = new Set(['happy', 'waiting', 'thinking', 'focus', 'sad', 'calm']);
function AnimatedFriends({ mood }) {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const artwork = useMemo(() => createDoranDoranSvg({ mood, animated: !reduced }), [mood, reduced]);
  // 원본 벡터만 사용한다. 사용자 콘텐츠를 SVG/HTML로 주입하지 않는다.
  return <span className="block h-full w-full [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: artwork }} />;
}

export default function DoranDoranMascot({ size = 'md', mood = 'happy', animated = true, className = '' }) {
  const height = typeof size === 'number' ? size : (SIZES[size] || SIZES.md);
  const width = Math.round(height * 4 / 3);
  const expression = MOODS.has(mood) ? mood : 'happy';
  const idle = animated && height >= SIZES.md && (expression === 'waiting' || expression === 'thinking');
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 ${className}`} style={{ width, height }}>
      {idle ? <AnimatedFriends mood={expression} /> : <img src={`/characters/dorandoran-${expression}.svg`} alt="" width={width} height={height}
        draggable={false} className="block h-full w-full select-none object-contain" />}
    </span>
  );
}
