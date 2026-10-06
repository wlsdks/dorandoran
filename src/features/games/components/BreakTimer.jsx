import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { breakActions, useBreakState } from '@/features/games/api/useBreakState';
import { formatClock, formatRemaining } from '@/lib/break-time';
import { spring, fadeUpSm, settle } from '@/lib/motion';
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
 * 타이머가 없을 땐 현재 시각(시:분). 모든 화면이 세션의 breakEndsAt(서버 시각)을 기준으로 같은 값을 본다.
 *
 * 상태가 바뀌어도 한 화면이 이어지게: 시계는 같은 카드가 새 숫자로 넘어가고(폭 변화는 layout), 설명과 조작은 교차 페이드.
 */
export default function BreakTimer({ sessionId, readOnly = false, presenter = false }) {
  const reduced = useReducedMotion();
  const state = useBreakState(sessionId);
  const { label, style, phase, remaining, endsAt } = state;
  const actions = breakActions(sessionId);
  const finished = phase === 'finished';
  const startAt = style === 'startAt' && phase !== 'idle';

  // 메인 숫자: 시작 시각(시:분) / 남은 시간 / 평소엔 현재 시각(시:분 — 초까지 여섯 장은 좁은 화면을 넘친다)
  const values = phase === 'idle' ? null
    : startAt ? clockValues(endsAt)
    : remaining >= 3600 ? [Math.floor(remaining / 3600), Math.floor((remaining % 3600) / 60), remaining % 60]
    : [Math.floor(remaining / 60), remaining % 60];
  const pairs = values ? values.length : 2;

  const heading = finished ? (startAt ? '지금 시작합니다' : `${label}이 끝났어요`) : label;
  const captionKey = phase === 'idle' ? 'now' : finished ? 'done' : startAt ? 'start' : 'countdown';
  const caption = phase === 'idle' ? '지금 시각'
    : finished ? null
    : startAt ? <><span className="font-bold text-slate-900 dark:text-slate-100">시작</span><span className="mx-3 text-slate-300 dark:text-slate-600" aria-hidden="true">·</span>{formatRemaining(remaining)} 남음</>
    : '남은 시간';
  const swapIn = reduced ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.08 } } : fadeUpSm;

  return (
    <div data-presenter={presenter} data-pairs={pairs} data-phase={phase} className={`break-timer-stage flex flex-col items-center w-full ${presenter ? 'max-w-[1200px] mx-auto' : ''}`} onClick={e => e.stopPropagation()}>
      <motion.div initial={{ opacity: 0, y: reduced ? 0 : -8 }} animate={{ opacity: 1, y: 0 }}
        transition={spring.default} className="flex items-center gap-3">
        <BreakMascot size={presenter ? 64 : 48} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={heading} {...swapIn} className={`break-timer-title ${presenter ? 'text-3xl md:text-4xl' : 'text-2xl md:text-3xl'} font-bold tracking-tight text-slate-900 dark:text-slate-100`}>{heading}</motion.p>
        </AnimatePresence>
      </motion.div>

      <motion.div layout={!reduced} initial={{ opacity: 0, scale: reduced ? 1 : 0.96 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ ...spring.default, delay: 0.05, layout: settle }}
        className={`break-clock-display flex flex-col items-center gap-4 ${finished && !reduced ? 'animate-pulse' : ''}`}>
        <FlipClock showSeconds={false} values={values} />
        {/* 설명 줄은 자리를 고정하고 그 안에서 겹쳐 교차 페이드한다 — 시계가 위아래로 밀리지 않는다 */}
        <div className={`relative w-full ${presenter ? 'break-caption-slot' : 'h-7'}`}>
          <AnimatePresence initial={false}>
            {caption && (
              <motion.p key={captionKey} {...swapIn} className={`absolute inset-0 flex items-center justify-center whitespace-nowrap break-timer-caption ${presenter ? 'text-2xl md:text-3xl' : 'text-lg md:text-xl'} text-slate-500 dark:text-slate-400 tabular-nums`}>
                {caption}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {!readOnly && (
        // 조작 패널도 가장 큰 상태(시작 전)의 높이로 자리를 잡아두고 겹쳐서 바꾼다 — 시작·종료가 한 화면의 연속 변화로 읽힌다
        <div className="relative w-full min-h-[15.25rem]">
          <AnimatePresence initial={false}>
            <motion.div key={`${style}-${phase === 'idle'}`} {...swapIn} className="absolute inset-x-0 top-0 flex justify-center">
              <BreakControls label={label} style={style} running={phase !== 'idle'}
                onLabel={actions.setLabel} onStart={actions.start} onStop={actions.stop} />
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
