import { useState, useRef, useEffect, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Minus, Plus, RotateCcw, Sparkles, Trophy, Monitor } from 'lucide-react';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import { useDrawDisplay, drawPrimary, drawSecondary } from '@/lib/draw-display';
import { useGameMirror } from '../api/useGameMirror';
import DrawDisplayToggle from './DrawDisplayToggle';
const ConfettiBurst = lazy(() => import('@/components/ui/ConfettiBurst'));
function pickLotteryWinners(participants, count) {
  const pool = [...participants];
  const winners = [];
  const wanted = Math.min(Math.max(0, count), pool.length);
  while (winners.length < wanted) winners.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return {
    winners
  };
}

/**
 * BigSlot — 중앙 큰 슬롯 카드. 한 번에 한 명씩 dramatic하게.
 * - rolling: 이름이 빠르게 지나감 (80ms 간격 슬롯머신)
 * - stopped: 큰 spring overshoot + sparkle burst + (1등이면) confetti
 */
function BigSlot({
  presenter,
  rollingPerson,
  winner,
  slotIdx,
  isLast,
  isFirst,
  displayMode
}) {
  const stopped = !!winner;
  const cardSize = presenter ? 'w-80 h-96 md:w-96 md:h-[28rem]' : 'w-56 h-72';
  const nameSize = presenter ? 'text-5xl md:text-6xl' : 'text-3xl';
  const avatarSize = presenter ? '2xl' : 'xl';
  const badgeSize = presenter ? 'text-base px-4 py-1.5' : 'text-xs px-3 py-1';
  return <motion.div key={`slot-${slotIdx}`} initial={{
    opacity: 0,
    scale: 0.85,
    y: 20
  }} animate={stopped ? {
    opacity: 1,
    scale: [1, 1.12, 0.96, 1.04, 1],
    y: 0
  } : {
    opacity: 1,
    scale: 1,
    y: 0,
    x: [0, -3, 3, -3, 3, 0]
  }} transition={stopped ? {
    scale: {
      type: 'spring',
      stiffness: 380,
      damping: 16
    },
    y: {
      duration: 0.3
    }
  } : {
    opacity: {
      duration: 0.3
    },
    scale: {
      duration: 0.3
    },
    y: {
      duration: 0.3
    },
    x: {
      duration: 0.18,
      repeat: Infinity,
      ease: 'easeInOut'
    }
  }} className={`relative ${cardSize} rounded-3xl bg-slate-900 shadow-2xl flex flex-col items-center justify-center overflow-hidden`} style={{
    perspective: 1000
  }}>
      {/* Sheen sweep */}
      <motion.div className="absolute inset-0 bg-white/15 rounded-3xl pointer-events-none" initial={{
      x: '-100%',
      skewX: '-20deg'
    }} animate={stopped ? {
      x: '200%'
    } : {
      x: ['-100%', '200%']
    }} transition={stopped ? {
      duration: 0.5,
      ease: 'easeOut',
      delay: 0.1
    } : {
      duration: 0.9,
      repeat: Infinity,
      ease: 'easeOut'
    }} />

      {stopped && <SparkleBurst presenter={presenter} />}
      {stopped && isFirst && <Suspense fallback={null}><ConfettiBurst /></Suspense>}

      <Avatar name={stopped ? winner.nickname : rollingPerson?.nickname} size={avatarSize} />
      {/* 롤링 중에는 이름이 아래에서 위로 넘어간다 — 슬롯머신 릴이 도는 감각 */}
      <div className={`relative overflow-hidden mt-4 ${presenter ? 'h-16 md:h-20' : 'h-10'} flex items-center justify-center w-full px-3`}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={stopped ? `w-${winner.id}` : `r-${rollingPerson?.id}-${slotIdx}`} initial={stopped ? {
          opacity: 0,
          scale: 0.8
        } : {
          y: '110%',
          opacity: 0.5
        }} animate={stopped ? {
          opacity: 1,
          scale: 1
        } : {
          y: '0%',
          opacity: 0.9
        }} exit={stopped ? {
          opacity: 0
        } : {
          y: '-110%',
          opacity: 0
        }} transition={stopped ? {
          type: 'spring',
          stiffness: 400,
          damping: 18
        } : {
          duration: 0.08,
          ease: 'linear'
        }} className={`text-white font-bold tracking-tight truncate max-w-full tabular-nums ${nameSize} ${!stopped ? 'blur-[0.6px]' : ''}`}>
            {drawPrimary(stopped ? winner : rollingPerson, displayMode)}
          </motion.div>
        </AnimatePresence>
      </div>
      {/* 사번 추첨은 당첨자를 사번으로 확인한다. 한쪽만 등록된 사람은 중복 표시하지 않는다. */}
      {stopped && drawSecondary(winner, displayMode) && <div className={`text-white/70 font-medium tabular-nums ${presenter ? 'text-2xl' : 'text-base'}`}>
          {drawSecondary(winner, displayMode)}
        </div>}
      <span className={`mt-3 rounded-full font-bold ${badgeSize} ${stopped ? 'bg-amber-500 text-white' : 'bg-white/10 text-white/60'}`}>
        {stopped ? `#${slotIdx + 1} 당첨` : '추첨 중...'}
      </span>
      {stopped && isLast && <p className={`mt-2 text-white/60 ${presenter ? 'text-sm' : 'text-xs'}`}>
          🎉 추첨 완료
        </p>}
    </motion.div>;
}

/** PastWinner — 이미 발표된 winner의 작은 뱃지. row 정렬. */
function PastWinner({
  winner,
  slotIdx,
  presenter,
  displayMode
}) {
  return <motion.div layout initial={{
    opacity: 0,
    scale: 0.8,
    y: -10
  }} animate={{
    opacity: 1,
    scale: 1,
    y: 0
  }} transition={{
    type: 'spring',
    stiffness: 360,
    damping: 22
  }} className={`inline-flex items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ${presenter ? 'px-4 py-2 text-base' : 'px-3 py-1.5 text-sm'}`}>
      <Trophy size={presenter ? 16 : 13} className="text-amber-500 shrink-0" />
      <span className="text-slate-400 font-bold">#{slotIdx + 1}</span>
      <span className="text-slate-900 dark:text-slate-100 font-bold tabular-nums">{drawPrimary(winner, displayMode)}</span>
      {drawSecondary(winner, displayMode) && <span className="text-slate-400 tabular-nums">{drawSecondary(winner, displayMode)}</span>}
    </motion.div>;
}

/** SparkleBurst — 슬롯 멈출 때 amber/white 별 분출 */
const SPARKLE_ANGLES = Array.from({
  length: 12
}, (_, i) => i * 360 / 12);
function SparkleBurst({
  presenter
}) {
  return <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {SPARKLE_ANGLES.map((angle, i) => {
      const rad = angle * Math.PI / 180;
      const distance = (presenter ? 120 : 80) + Math.random() * 30;
      return <motion.div key={i} className={`absolute top-1/2 left-1/2 ${presenter ? 'w-3 h-3' : 'w-2 h-2'} rounded-full ${i % 2 === 0 ? 'bg-amber-300' : 'bg-white'}`} style={{
        marginLeft: presenter ? -6 : -4,
        marginTop: presenter ? -6 : -4
      }} initial={{
        x: 0,
        y: 0,
        scale: 0,
        opacity: 0
      }} animate={{
        x: Math.cos(rad) * distance,
        y: Math.sin(rad) * distance,
        scale: [0, 1.4, 0],
        opacity: [0, 1, 0]
      }} transition={{
        duration: 0.85,
        ease: [0.25, 0.1, 0.25, 1]
      }} />;
    })}
    </div>;
}

/**
 * Lottery — 복권 풍 sequential 추첨.
 *
 * 흐름:
 *   1. 추첨 인원 N 설정 (1 이상)
 *   2. "추첨하기" → 중앙에 큰 슬롯 1개 등장 → 이름 빠르게 회전 → 한 명 dramatic stop
 *   3. 2초 대기 후 → 다음 슬롯 (이전 winner는 상단 뱃지로 이동)
 *   4. N명 모두 끝나면 revealed 상태
 *
 * 한 번에 한 명씩 강조해서 진짜 복권/제비뽑기 느낌.
 */
export default function Lottery({
  participants,
  onResult,
  presenter = false,
  sessionId,
  role = 'control'
}) {
  // 전자칠판(view)은 조작하지 않는다 — 강사 화면이 돌리는 추첨을 그대로 비춘다.
  const isView = role === 'view';
  const {
    remote,
    publish
  } = useGameMirror(sessionId, {
    role,
    mode: 'lottery'
  });
  const [count, setCount] = useState(1);
  const [phase, setPhase] = useState('idle'); // idle | rolling | revealed
  const [winners, setWinners] = useState([]); // 발표된 winner들 누적
  const [rollingPerson, setRollingPerson] = useState(null); // 현재 슬롯에서 돌고 있는 사람
  const [displayMode, setDisplayMode] = useDrawDisplay();
  const [currentSlot, setCurrentSlot] = useState(-1); // 현재 발표 중인 슬롯 (0~N-1)
  const [pickedList, setPickedList] = useState([]); // 미리 결정된 winner 리스트
  const mountedRef = useRef(true);
  const timersRef = useRef([]);
  const intervalsRef = useRef([]);
  const serialRef = useRef(0);

  // 강사 화면의 진행 상태를 전자칠판으로 흘려보낸다
  useEffect(() => {
    if (isView) return;
    publish({
      serial: serialRef.current,
      phase,
      currentSlot,
      winners,
      total: pickedList.length
    });
  }, [isView, phase, currentSlot, winners, pickedList.length, publish]);

  // 전자칠판이 따라 그릴 값 — 조작 화면에서는 자기 상태를 그대로 쓴다
  const viewPhase = isView ? remote?.phase || 'idle' : phase;
  const viewSlot = isView ? remote?.currentSlot ?? -1 : currentSlot;
  const viewWinners = useMemo(() => isView ? remote?.winners || [] : winners, [isView, remote?.winners, winners]);
  const viewTotal = isView ? remote?.total || 0 : pickedList.length;

  // 전자칠판에서도 이름이 돌아야 한다 — 굴러가는 이름은 연출이라 각 화면이 따로 만든다
  useEffect(() => {
    if (!isView) return;
    if (viewPhase !== 'rolling' || viewWinners[viewSlot] || participants.length === 0) return;
    const spin = setInterval(() => {
      setRollingPerson(participants[Math.floor(Math.random() * participants.length)]);
    }, 80);
    return () => clearInterval(spin);
  }, [isView, viewPhase, viewSlot, viewWinners, participants]);

  // 확정된 슬롯에서는 당첨자에 멈춘다
  useEffect(() => {
    if (!isView) return;
    const stopped = viewWinners[viewSlot];
    if (stopped) setRollingPerson(stopped);
  }, [isView, viewWinners, viewSlot]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timersRef.current.forEach(clearTimeout);
      intervalsRef.current.forEach(clearInterval);
    };
  }, []);
  const hasEmployeeIds = participants.some(p => p.employeeId);
  const eligibleParticipants = participants;
  function rollSlot(slotIdx, picked) {
    setCurrentSlot(slotIdx);
    setRollingPerson(participants[0] || null);

    // 80ms 간격 이름 회전
    const interval = setInterval(() => {
      if (!mountedRef.current) return;
      setRollingPerson(participants[Math.floor(Math.random() * participants.length)]);
    }, 80);
    intervalsRef.current.push(interval);

    // 2초 후 stop + winner 발표
    const stopAt = 2000;
    const timer = setTimeout(() => {
      if (!mountedRef.current) return;
      clearInterval(interval);
      setRollingPerson(picked[slotIdx]);
      setWinners(prev => [...prev, picked[slotIdx]]);

      // 마지막 슬롯이면 phase 변경, 아니면 1.2초 후 다음 슬롯
      if (slotIdx === picked.length - 1) {
        const endTimer = setTimeout(() => {
          if (!mountedRef.current) return;
          setPhase('revealed');
          // 닉네임이 아닌 {id, nickname} 객체 전달 — 동명이인이어도 실제 뽑힌 학생 id로 당첨 귀속(오귀속 방지)
          // employeeId까지 넘긴다 — 사번 추첨에서는 사번이 당첨자를 확인하는 실제 식별자다
          onResult?.(picked.map(w => ({
            id: w.id,
            nickname: w.nickname,
            ...(w.employeeId ? {
              employeeId: w.employeeId
            } : {})
          })));
        }, 800);
        timersRef.current.push(endTimer);
      } else {
        const nextTimer = setTimeout(() => {
          if (!mountedRef.current) return;
          rollSlot(slotIdx + 1, picked);
        }, 1200);
        timersRef.current.push(nextTimer);
      }
    }, stopAt);
    timersRef.current.push(timer);
  }
  function draw() {
    if (phase === 'rolling' || participants.length === 0) return;
    const normalizedCount = Number.isFinite(count) && count > 0 ? count : 1;
    const {
      winners: picked
    } = pickLotteryWinners(participants, normalizedCount);
    if (picked.length === 0) return;
    timersRef.current.forEach(clearTimeout);
    intervalsRef.current.forEach(clearInterval);
    timersRef.current = [];
    intervalsRef.current = [];
    serialRef.current += 1;
    setPhase('rolling');
    setWinners([]);
    setPickedList(picked);
    setCurrentSlot(0);
    rollSlot(0, picked);
  }
  function reset() {
    timersRef.current.forEach(clearTimeout);
    intervalsRef.current.forEach(clearInterval);
    setPhase('idle');
    setWinners([]);
    setCurrentSlot(-1);
    setRollingPerson(null);
    setPickedList([]);
  }
  if (!isView && participants.length === 0) {
    return <div className="flex flex-col items-center justify-center gap-4 py-16" onClick={e => e.stopPropagation()}>
        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <Gift size={28} className="text-slate-300 dark:text-slate-600" />
        </div>
        <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {'제비뽑기'}
        </h3>
        <p className="text-slate-400 text-base">참여자가 접속하면 시작할 수 있어요</p>
      </div>;
  }
  const isRolling = viewPhase === 'rolling';
  const currentWinner = viewWinners[viewSlot]; // 해당 슬롯이 멈췄으면 winner

  return <div className="flex flex-col items-center gap-6 w-full max-w-3xl mx-auto" onClick={e => e.stopPropagation()}>
      {/* Count selector — 조작 화면의 idle에서만. 전자칠판에는 조작 수단을 두지 않는다. */}
      {!isView && viewPhase === 'idle' && <>
          <div className="flex items-center gap-3">
            <span className={`text-slate-500 font-medium ${presenter ? 'text-base' : 'text-sm'}`}>당첨자 수</span>
            <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden">
              <button onClick={() => setCount(Math.max(1, count - 1))} aria-label="당첨자 수 감소" className={`flex items-center justify-center text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600 transition-colors duration-150 ${presenter ? 'w-14 h-14' : 'w-12 h-12'}`}>
                <Minus size={presenter ? 20 : 16} />
              </button>
              <input type="number" min={1} max={eligibleParticipants.length} value={count} onChange={e => setCount(Math.max(1, Math.min(eligibleParticipants.length, Number(e.target.value))))} aria-label="당첨자 수" className={`bg-transparent text-slate-900 dark:text-slate-100 dark:bg-transparent text-center font-bold focus:outline-none ${presenter ? 'w-16 h-14 text-lg' : 'w-12 h-12 text-sm'}`} />
              <button onClick={() => setCount(Math.min(eligibleParticipants.length, count + 1))} aria-label="당첨자 수 증가" className={`flex items-center justify-center text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600 transition-colors duration-150 ${presenter ? 'w-14 h-14' : 'w-12 h-12'}`}>
                <Plus size={presenter ? 20 : 16} />
              </button>
            </div>
            <span className={`text-slate-400 ${presenter ? 'text-base' : 'text-sm'}`}>/ {eligibleParticipants.length}명</span>
          </div>
          <div className="text-center space-y-1">
            <p className={`text-slate-500 ${presenter ? 'text-base' : 'text-sm'}`}>
              모든 참여자에게 같은 확률
              {' · '}
              <span className="font-medium">한 명씩 순서대로 발표</span>
            </p>

          </div>
        </>}

      {/* 표시 기준은 추첨 중에도 바꿀 수 있어야 한다. 발표 도중 "사번으로 불러주세요" 같은
          요청이 들어오면 판을 다시 돌릴 수는 없다. */}
      {!isView && hasEmployeeIds && <DrawDisplayToggle mode={displayMode} onChange={setDisplayMode} presenter={presenter} />}

      {/* Rolling 페이즈 헤더 */}
      <AnimatePresence>
        {isRolling && <motion.div initial={{
        opacity: 0,
        y: -8
      }} animate={{
        opacity: 1,
        y: 0
      }} exit={{
        opacity: 0,
        y: -8
      }} className="flex items-center gap-2">
            <motion.div animate={{
          rotate: [0, -8, 8, -8, 8, 0]
        }} transition={{
          duration: 0.6,
          repeat: Infinity,
          ease: 'easeInOut'
        }}>
              <Sparkles size={presenter ? 24 : 18} className="text-amber-500" />
            </motion.div>
            <p className={`text-slate-700 dark:text-slate-200 font-bold tracking-tight ${presenter ? 'text-2xl' : 'text-lg'}`}>
              {currentWinner ? `${viewSlot + 1}등 발표!` : '두근두근...'}
            </p>
            <span className={`text-slate-400 tabular-nums ${presenter ? 'text-lg' : 'text-sm'}`}>
              {viewSlot + 1}/{viewTotal}
            </span>
          </motion.div>}
      </AnimatePresence>

      {/* 이미 발표된 winners — 상단 뱃지 row */}
      {isRolling && viewWinners.length > 0 && viewSlot < viewTotal - 1 && <div className="flex flex-wrap justify-center gap-2 px-4">
          {viewWinners.slice(0, viewSlot).map((w, i) => <PastWinner key={`past-${i}`} winner={w} slotIdx={i} presenter={presenter} displayMode={displayMode} />)}
        </div>}

      {/* 중앙: 현재 회전 중인 큰 슬롯 (rolling) 또는 발표 끝난 모든 winners (revealed) */}
      <div className={`flex items-center justify-center ${presenter ? 'min-h-[28rem]' : 'min-h-[18rem]'}`}>
        <AnimatePresence mode="wait">
          {viewPhase === 'idle' && <motion.div key="idle" initial={{
          opacity: 0
        }} animate={{
          opacity: 1
        }} exit={{
          opacity: 0
        }} className="text-center space-y-3">
              {isView ? <DoranDoranMascot size={160} mood="waiting" /> : <Gift size={presenter ? 56 : 32} className="text-slate-400 mx-auto" />}
              {isView && <h2 className="text-3xl font-semibold text-slate-100">추첨을 준비하고 있어요</h2>}
              <p className={`text-slate-400 ${presenter ? 'text-2xl' : 'text-base'}`}>
                {isView ? '곧 함께 당첨자를 확인해요' : '추첨 버튼을 눌러주세요'}
              </p>
            </motion.div>}

          {isRolling && viewSlot >= 0 && <BigSlot key={`slot-${viewSlot}-${viewWinners[viewSlot] ? 'stop' : 'roll'}`} presenter={presenter} rollingPerson={rollingPerson} displayMode={displayMode} winner={viewWinners[viewSlot] || null} slotIdx={viewSlot} isLast={viewSlot === viewTotal - 1 && !!viewWinners[viewSlot]} isFirst={viewSlot === 0} />}

          {viewPhase === 'revealed' && <motion.div key="revealed" initial={{
          opacity: 0,
          y: 12
        }} animate={{
          opacity: 1,
          y: 0
        }} exit={{
          opacity: 0
        }} transition={{
          type: 'spring',
          stiffness: 300,
          damping: 25
        }} className="flex flex-col items-center gap-5">
              <Suspense fallback={null}><ConfettiBurst /></Suspense>
              <h3 className={`font-black tracking-tight text-slate-900 dark:text-slate-100 ${presenter ? 'text-4xl' : 'text-2xl'}`}>
                🎉 {viewWinners.length}명 당첨!
              </h3>
              <div className={`flex flex-wrap justify-center ${presenter ? 'gap-4' : 'gap-3'}`}>
                {viewWinners.map((w, i) => <motion.div key={`final-${i}`} layout initial={{
              opacity: 0,
              scale: 0.85
            }} animate={{
              opacity: 1,
              scale: 1
            }} transition={{
              delay: i * 0.08,
              type: 'spring',
              stiffness: 360,
              damping: 22
            }} className={`flex flex-col items-center bg-slate-900 rounded-2xl shadow-lg ${presenter ? 'w-40 h-48 p-5' : 'w-28 h-36 p-3'}`}>
                    <Avatar name={w.nickname} size={presenter ? 'xl' : 'lg'} />
                    {/* 발표 후 남는 화면 — 강사가 당첨자를 호명하는 곳이라 사번이 여기에도 있어야 한다. */}
                    <div className={`text-white font-bold mt-3 tabular-nums truncate max-w-full ${presenter ? 'text-xl' : 'text-base'}`}>
                      {drawPrimary(w, displayMode)}
                    </div>
                    {drawSecondary(w, displayMode) && <div className={`text-white/60 font-medium tabular-nums truncate max-w-full ${presenter ? 'text-base mt-1' : 'text-[11px]'}`}>
                        {drawSecondary(w, displayMode)}
                      </div>}
                    <span className={`mt-2 rounded-full bg-amber-500 text-white font-bold ${presenter ? 'text-sm px-3 py-1' : 'text-[10px] px-2 py-0.5'}`}>
                      #{i + 1} 당첨
                    </span>
                  </motion.div>)}
              </div>
            </motion.div>}
        </AnimatePresence>
      </div>

      {isView ? <p className="inline-flex items-center gap-1.5 text-slate-400 text-sm">
          <Monitor size={14} />
          결과가 실시간으로 함께 표시됩니다
        </p> : <div className="flex gap-3">
        {viewPhase === 'revealed' && <Button onClick={reset} variant="secondary" size={presenter ? 'lg' : 'md'}>
            <RotateCcw size={presenter ? 20 : 16} />
            초기화
          </Button>}
        <Button onClick={draw} disabled={isRolling || eligibleParticipants.length === 0} variant="primary" size={presenter ? 'lg' : 'md'}>
          {isRolling ? <span className="flex items-center gap-2">
              <motion.span animate={{
            rotate: 360
          }} transition={{
            duration: 1.2,
            repeat: Infinity,
            ease: 'linear'
          }}>
                <Sparkles size={presenter ? 24 : 20} />
              </motion.span>
              발표 중...
            </span> : <span className="flex items-center gap-2">
              <Gift size={presenter ? 24 : 20} />
              {viewPhase === 'revealed' ? '다시 추첨' : '추첨 시작'}
            </span>}
        </Button>
      </div>}
    </div>;
}
