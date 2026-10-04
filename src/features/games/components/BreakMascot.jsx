import DoranDoranMascot from '@/components/ui/DoranDoranMascot';

/** 쉬는 시간에는 두 친구도 잠깐 눈을 감고 쉰다. */
export default function BreakMascot({ size = 140 }) {
  return <DoranDoranMascot size={size} mood="calm" />;
}
