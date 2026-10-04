import DoranDoranMascot from '@/components/ui/DoranDoranMascot';

/** 다음 이야기를 기다리는 도란·두런. 공통 마스코트가 움직임 줄이기 설정을 따른다. */
export default function IdleMascot() {
  return <DoranDoranMascot size={140} mood="waiting" />;
}
