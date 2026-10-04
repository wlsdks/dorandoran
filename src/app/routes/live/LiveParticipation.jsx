import AnimatedNumber from '@/components/ui/AnimatedNumber';
import { memo } from 'react';

/** 과거 응답을 접속 인원으로 나누면 10/0 같은 표시가 생긴다. 두 상태를 명확히 구분한다. */
export default memo(function LiveParticipation({ voted, total }) {
  return <div className="classroom-results flex justify-end items-center gap-3 text-base lg:text-lg text-slate-300">
    <span>응답 <AnimatedNumber value={voted} className="font-semibold tabular-nums text-slate-100" />명</span>
    <span className="text-slate-500" aria-hidden="true">·</span>
    <span>현재 접속 <AnimatedNumber value={total} className="font-semibold tabular-nums text-slate-100" />명</span>
  </div>;
});
