import { motion, useReducedMotion } from 'framer-motion';
import { spring } from '@/lib/motion';
import { breakActions, useBreakState } from '@/features/games/api/useBreakState';
import { formatClock, formatRemaining } from '@/lib/break-time';
import BreakMascot from './BreakMascot';
import FlipClock from './FlipClock';
import BreakControls from './BreakControls';
import './LargeDisplayGames.css';

function clockValues(ms) {
  return formatClock(ms).split(':').map(Number);
}

/**
 * BreakTimer — 쉬는 시간/대기 시간 화면(전자칠판·발표모드·강사 대시보드 공용).
 * 표시 방식 두 가지: 남은 시간 카운트다운(MM:SS) 또는 "21:40 시작" 시작 시각.
 * 타이머가 없을 땐 현재 시각. 모든 화면이 세션의 breakEndsAt(서버 시각)을 기준으로 같은 값을 본다.
 */
export default function BreakTimer({ sessionId, readOnly = false, presenter = false }) {
  const reduced = useReducedMotion();
  const state = useBreakState(sessionId);
  const { label, style, phase, remaining, endsAt } = state;
  const actions = breakActions(sessionId);
  const finished = phase === 'finished';
  const startAt = style === 'startAt' && phase !== 'idle';

  // 메인 숫자: 시작 시각(시:분) / 남은 시간 / 평소엔 현재 시각
  const values = phase === 'idle' ? null
    : startAt ? clockValues(endsAt)
    : remaining >= 3600 ? [Math.floor(remaining / 3600), Math.floor((remaining % 3600) / 60), remaining % 60]
    : [Math.floor(remaining / 60), remaining % 60];

  const heading = finished ? (startAt ? '지금 시작합니다' : `${label}이 끝났어요`) : label;

  return (
    <div data-presenter={presenter} className={`break-timer-stage flex flex-col items-center gap-8 md:gap-10 w-full ${presenter ? 'max-w-[1200px] mx-auto' : ''}`} onClick={e => e.stopPropagation()}>
      <motion.div initial={{ opacity: 0, y: reduced ? 0 : -8 }} animate={{ opacity: 1, y: 0 }}
        transition={spring.default} className="flex items-center gap-3">
        <BreakMascot size={presenter ? 64 : 48} />
        <p className={`break-timer-title ${presenter ? 'text-3xl md:text-4xl' : 'text-2xl md:text-3xl'} font-bold tracking-tight text-slate-900 dark:text-slate-100`}>{heading}</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, scale: reduced ? 1 : 0.96 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ ...spring.default, delay: 0.05 }}
        className={`break-clock-display flex flex-col items-center gap-4 ${finished && !reduced ? 'animate-pulse' : ''}`}>
        <FlipClock key={startAt ? 'start' : values ? 'countdown' : 'clock'} showSeconds={!startAt} values={values} />
        {/* 시작 시각 방식: 큰 숫자는 시각, 아래 한 줄로 "시작 · 남은 시간" — 숫자 옆에 붙이면 가운데 정렬이 깨진다 */}
        {startAt && !finished && (
          <p className={`break-timer-caption ${presenter ? 'text-2xl md:text-3xl' : 'text-lg md:text-xl'} text-slate-500 dark:text-slate-400 tabular-nums`}>
            <span className="font-bold text-slate-900 dark:text-slate-100">시작</span>
            <span className="mx-3 text-slate-300 dark:text-slate-600" aria-hidden="true">·</span>{formatRemaining(remaining)} 남음
          </p>
        )}
      </motion.div>

      {!readOnly && (
        <BreakControls key={`${style}-${phase === 'idle'}`} label={label} style={style} running={phase !== 'idle'}
          onLabel={actions.setLabel} onStart={actions.start} onStop={actions.stop} />
      )}
    </div>
  );
}
