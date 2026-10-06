import { useState, useRef, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { spring, reveal } from '@/lib/motion';
import { UserCircle, RefreshCw, Monitor } from 'lucide-react';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import { useDrawDisplay, drawPrimary, drawSecondary } from '@/lib/draw-display';
import { useGameMirror } from '../api/useGameMirror';
import DrawDisplayToggle from './DrawDisplayToggle';
import { hapticSuccess } from '@/lib/haptics';

const ConfettiBurst = lazy(() => import('@/components/ui/ConfettiBurst'));

/** 빠르게 도는 구간. 이 뒤부터 3·2·1이 시작된다. */
const SPIN_MS = 2000;
/** 카운트다운 한 칸. 숫자 하나를 눈으로 읽고 "다음!" 하고 셀 수 있는 길이. */
const TICK_MS = 1000;
/**
 * 1이 끝난 뒤 이름을 가리는 시간.
 * 이름은 멈추지 않고 계속 돌되 뿌옇게 가려진다 — 멈춘 채로 뜸을 들이면 "이미 정해졌는데
 * 왜 안 나오지"처럼 보이고, 가려진 채 도는 편이 "지금 고르는 중"으로 읽힌다.
 */
const MASK_MS = 700;
/** 카운트다운 숫자별 회전 간격. 숫자가 내려갈수록 느려지고 뿌예진다. */
const TENSION = { 3: { spin: 240 }, 2: { spin: 400 }, 1: { spin: 620 } };

/**
 * RandomPicker — 랜덤 발표자 선정 (콜드콜).
 * 이름이 빠르게 순환 → 감속 → 멈춤 → 발표자 reveal.
 * 연속 중복 방지. 확정 시 onResult([{id,nickname}]) — 뽑힌 학생 폰에 알림(gameResult publish).
 */
export default function RandomPicker({ participants, onResult, sessionId, role = 'control', presenter = false }) {
  // 전자칠판(view)은 조작하지 않는다 — 강사 화면이 뽑는 과정을 그대로 비춘다.
  const reduced = useReducedMotion();
  const isView = role === 'view';
  const { remote, publish } = useGameMirror(sessionId, { role, mode: 'randomPicker' });
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState(null);       // 확정된 발표자(객체)
  const [rolling, setRolling] = useState(null);         // 도는 중 스쳐가는 사람(객체)
  const [countdown, setCountdown] = useState(null);     // 3 | 2 | 1 | null
  const [masked, setMasked] = useState(false);           // 공개 직전, 이름을 가린 채 돌리는 구간
  const [storedDisplayMode, setDisplayMode] = useDrawDisplay();
  const displayMode = isView ? remote?.displayMode || storedDisplayMode : storedDisplayMode;
  const [mirrorError, setMirrorError] = useState(false);
  const [history, setHistory] = useState([]);
  const mountedRef = useRef(true);
  const intervalRef = useRef(null);
  const timeoutsRef = useRef([]);
  const serialRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    const timeouts = timeoutsRef.current;
    const interval = intervalRef;
    return () => {
      mountedRef.current = false;
      if (interval.current) clearInterval(interval.current);
      timeouts.forEach(clearTimeout);
    };
  }, []);

  const names = useMemo(() => participants.map(p => p.nickname), [participants]);

  // 강사 화면의 진행 상태를 전자칠판으로 흘려보낸다
  useEffect(() => {
    if (isView) return;
    publish({
      serial: serialRef.current,
      picking,
      countdown: countdown ?? null,
      masked, displayMode,
      selected: selected ? { id: selected.id, nickname: selected.nickname, ...(selected.employeeId ? { employeeId: selected.employeeId } : {}) } : null,
    });
  }, [isView, picking, countdown, masked, selected, publish, displayMode]);

  // 전자칠판이 따라 그릴 값
  const viewPicking = isView ? !!remote?.picking : picking;
  const viewSelected = isView ? (remote?.selected || null) : selected;
  const viewCountdown = isView ? (remote?.countdown ?? null) : countdown;
  const viewMasked = isView ? !!remote?.masked : masked;

  // 전자칠판에서도 이름이 돌아야 한다 — 굴러가는 이름은 연출이라 각 화면이 따로 만든다
  useEffect(() => {
    if (!isView) return;
    if (reduced || viewMasked || !viewPicking || viewSelected || participants.length === 0) return;
    const interval = TENSION[viewCountdown]?.spin ?? 90;
    const spin = setInterval(() => {
      setRolling(participants[Math.floor(Math.random() * participants.length)]);
    }, interval);
    return () => clearInterval(spin);
  }, [isView, viewPicking, viewSelected, viewCountdown, viewMasked, participants, reduced]);
  const hasEmployeeIds = useMemo(() => participants.some(p => p.employeeId), [participants]);
  const randomPerson = useCallback(() => participants[Math.floor(Math.random() * participants.length)], [participants]);

  /**
   * 뽑기 연출 타임라인.
   *
   * 예전에는 이름이 빠르게 돌다가 그냥 멈췄다. 너무 빨라서 긴장할 틈이 없었다.
   * 지금은 세 단계로 나눈다 — 빠르게 돌기 → 3·2·1 카운트다운(점점 느려지고 흐려짐) → 공개.
   * 카운트다운 동안 회전 간격과 흐림이 함께 커져서 "곧 나온다"가 눈에 보인다.
   */
  const pick = useCallback(() => {
    if (isView || picking || names.length === 0) return;
    setMirrorError(false);
    timeoutsRef.current.splice(0).forEach(clearTimeout);
    serialRef.current += 1;
    setPicking(true);
    setSelected(null);
    setCountdown(null);
    setMasked(false);

    // 최근에 뽑힌 사람은 잠시 제외 — 같은 사람이 연달아 나오면 뽑기로 보이지 않는다
    const excluded = new Set(history.slice(-Math.min(3, Math.floor(names.length / 2))).map(person => person.id));
    // 참가자 객체로 뽑아 id를 보존 — 닉네임 문자열만 넘기면 동명이인 오귀속 가능
    const candidates = participants.filter(p => !excluded.has(p.id));
    const pool = candidates.length > 0 ? candidates : participants;
    const winnerP = pool[Math.floor(Math.random() * pool.length)];

    const spin = (intervalMs) => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (reduced) return;
      intervalRef.current = setInterval(() => {
        if (!mountedRef.current) return;
        setRolling(randomPerson());
      }, intervalMs);
    };
    const at = (ms, fn) => {
      const id = setTimeout(() => {
        const index = timeoutsRef.current.indexOf(id);
        if (index >= 0) timeoutsRef.current.splice(index, 1);
        if (mountedRef.current) fn();
      }, ms);
      timeoutsRef.current.push(id);
    };

    // 공개 순간에 confetti 청크를 처음 불러오면 그 틈에 화면이 한 번 걸린다. 미리 받아둔다.
    import('@/components/ui/ConfettiBurst').catch(() => {});

    spin(70);                                                 // 0.0s 빠르게 돌기
    at(SPIN_MS, () => { setCountdown(3); spin(TENSION[3].spin); });
    at(SPIN_MS + TICK_MS, () => { setCountdown(2); spin(TENSION[2].spin); });
    at(SPIN_MS + TICK_MS * 2, () => { setCountdown(1); spin(TENSION[1].spin); });
    // 1이 끝나면 이름을 가린다. 표시하지 않는 이름의 재렌더를 멈추고 확정된 사람을 공개한다.
    at(SPIN_MS + TICK_MS * 3, () => {
      setCountdown(null);
      setMasked(true);
      if (intervalRef.current) clearInterval(intervalRef.current);
    });
    at(SPIN_MS + TICK_MS * 3 + MASK_MS, async () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      const serial = serialRef.current;
      const synchronized = await publish({ serial, picking: false, countdown: null, masked: false, selected: winnerP, displayMode });
      if (!mountedRef.current || serialRef.current !== serial) return;
      setMasked(false);
      setRolling(winnerP);
      setPicking(false);
      setSelected(winnerP);
      setHistory(prev => [...prev, { id: winnerP.id, nickname: winnerP.nickname }]);
      if (!synchronized) { setMirrorError(true); return; }
      hapticSuccess();
      // employeeId까지 넘긴다 — 사번으로 호명하는 자리에서는 사번이 실제 식별자다
      onResult?.([{
        id: winnerP.id,
        nickname: winnerP.nickname,
        ...(winnerP.employeeId ? { employeeId: winnerP.employeeId } : {}),
      }]);
    });
  }, [isView, picking, names, history, participants, randomPerson, onResult, publish, displayMode, reduced]);

  if (!isView && names.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16" onClick={e => e.stopPropagation()}>
        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <UserCircle size={28} className="text-slate-300 dark:text-slate-600" />
        </div>
        <h3 className={`${presenter ? "text-[clamp(30px,3vw,56px)]" : "text-2xl"} font-bold tracking-tight text-slate-900 dark:text-slate-100`}>발표자 뽑기</h3>
        <p className="text-slate-400 text-base">참여자가 접속하면 시작할 수 있어요</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-8 w-full mx-auto ${presenter ? "max-w-[min(86vw,1280px)]" : "max-w-lg"}`} onClick={e => e.stopPropagation()}>
      <div className="h-16 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {viewCountdown ? (
            <motion.span
              key={`cd-${viewCountdown}`}
              initial={{ scale: reduced ? 1 : 1.15, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              // 퇴장은 짧은 tween으로 고정한다. spring 퇴장이 끝나기를 기다리는 사이
              // 다음 숫자가 통째로 건너뛰어졌다(3 → 1로 보이던 문제).
              exit={{ scale: reduced ? 1 : 0.6, opacity: 0, transition: { duration: 0.12 } }}
              transition={spring.bouncy}
              className="text-6xl font-black tabular-nums text-slate-900 dark:text-slate-100 tracking-tighter"
            >
              {viewCountdown}
            </motion.span>
          ) : (
            <motion.h3
              key="title"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              className={`${presenter ? "text-[clamp(30px,3vw,56px)]" : "text-2xl"} font-bold tracking-tight text-slate-900 dark:text-slate-100`}
            >
              발표자 뽑기
            </motion.h3>
          )}
        </AnimatePresence>
      </div>
      {!isView && hasEmployeeIds && <DrawDisplayToggle mode={displayMode} onChange={setDisplayMode} />}

      {/* Name display area */}
      <div className="w-full flex flex-col items-center gap-6">
        <AnimatePresence mode="wait">
          {viewSelected ? (
            <motion.div
              key="selected-avatar"
              initial={{ scale: reduced ? 1 : 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: reduced ? 1 : 0.8, opacity: 0 }}
              transition={spring.bouncy}
            >
              <Avatar name={viewSelected.nickname} size="2xl" className={presenter ? "!w-[clamp(128px,12vw,256px)] !h-[clamp(128px,12vw,256px)] !text-[clamp(40px,4vw,80px)]" : ""} />
              {!reduced && !mirrorError && <Suspense fallback={null}><ConfettiBurst /></Suspense>}
            </motion.div>
          ) : viewPicking && rolling && !reduced ? (
            <motion.div
              key="cycling"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, scale: [1, 1.04, 1] }}
              exit={{ opacity: 0 }}
              transition={{ scale: { duration: 0.6, repeat: Infinity, ease: 'easeInOut' } }}
              className="relative w-32 h-32 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden"
            >
              {/* 릴이 도는 동안 훑고 지나가는 광택 */}
              <motion.div
                className="absolute inset-0 bg-white/25 dark:bg-white/10"
                initial={{ x: '-120%', skewX: '-18deg' }}
                animate={{ x: ['-120%', '160%'] }}
                transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.span
                key={rolling.id}
                initial={{ y: '80%', opacity: 0.2 }}
                animate={{ y: '0%', opacity: 0.65 }}
                transition={{ duration: 0.09, ease: 'linear' }}
                className="text-4xl font-bold text-slate-900 dark:text-slate-100"
              >
                {(drawPrimary(rolling, displayMode) || '?').charAt(0).toUpperCase()}
              </motion.span>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-32 h-32 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
            >
              <motion.div
                animate={reduced ? { opacity: 1 } : { opacity: [0.5, 1, 0.5] }}
                transition={reduced ? { duration: 0 } : { duration: 2, repeat: Infinity }}
              >
                <UserCircle size={48} className="text-slate-300 dark:text-slate-600" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Name text */}
        <div className="h-16 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {viewSelected ? (
              <motion.div
                key="selected"
                initial={{ opacity: 0.6, scale: reduced ? 1 : 0.96 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  x: reduced ? 0 : [0, -4, 3, 0], // 흐림이 걷히는 동안 한 번 흔들린다
                }}
                transition={{
                  opacity: { duration: 0.5, ease: 'easeOut' },
                  scale: { ...reveal, delay: 0.25 },
                  x: { duration: 0.6, ease: 'easeInOut', delay: 0.3 },
                }}
                className="text-center"
              >
                <p className={`${presenter ? "text-[clamp(40px,4.6vw,96px)] break-words" : "text-4xl md:text-5xl"} font-bold text-slate-900 dark:text-slate-100 tracking-tight tabular-nums`}>
                  {drawPrimary(viewSelected, displayMode)}
                </p>
                {drawSecondary(viewSelected, displayMode) && (
                  <p className={`${presenter ? "text-2xl md:text-3xl" : "text-lg"} text-slate-400 tabular-nums mt-2`}>{drawSecondary(viewSelected, displayMode)}</p>
                )}
              </motion.div>
            ) : viewPicking && rolling && !reduced ? (
              <motion.p
                key={rolling.id}
                initial={{ y: 14, opacity: 0.15 }}
                animate={{ y: 0, opacity: 0.6 }}
                exit={{ y: -14, opacity: 0 }}
                transition={{ duration: 0.09, ease: 'linear' }}

                className="text-3xl font-bold text-slate-400 dark:text-slate-500 tracking-tight tabular-nums"
              >
                {viewMasked ? '곧 공개합니다' : drawPrimary(rolling, displayMode)}
              </motion.p>
            ) : (
              <p className={isView ? "text-2xl text-slate-300" : "text-lg text-slate-400"}>
                {viewPicking ? '발표자를 고르고 있어요' : isView ? '곧 함께 발표자를 확인해요' : '버튼을 눌러 발표자를 뽑으세요'}
              </p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Selected badge */}
      <AnimatePresence>
        {viewSelected && (
          <motion.span
            initial={{ opacity: 0, scale: reduced ? 1 : 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ ...spring.default, delay: 0.15 }}
            className="inline-flex items-center px-5 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-full text-base font-bold"
          >
            {mirrorError ? '결과 공유 대기' : '발표 차례!'}
          </motion.span>
        )}
      </AnimatePresence>

      {mirrorError && !isView && <p role="alert" className="text-sm text-red-300">전자칠판 연결을 확인해주세요. 결과 알림은 아직 보내지 않았어요.</p>}
      {/* Controls — 전자칠판에는 조작 수단을 두지 않는다 */}
      {isView ? (
        <p className="inline-flex items-center gap-1.5 text-slate-400 text-sm">
          <Monitor size={14} />
          결과가 실시간으로 함께 표시됩니다
        </p>
      ) : (
      <div className="flex gap-3">
        {selected && (
          <Button onClick={() => { if (isView) return; setSelected(null); setRolling(null); setMirrorError(false); }} variant="secondary" size="lg">
            <RefreshCw size={18} /> 다시 뽑기
          </Button>
        )}
        <Button onClick={pick} disabled={picking} variant="primary" size="lg">
          {picking ? (
            <span className="flex items-center gap-2">
              <motion.span
                animate={{ rotate: reduced ? 0 : 360 }}
                transition={reduced ? { duration: 0 } : { duration: 0.8, repeat: Infinity, ease: 'linear' }}
                className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
              />
              뽑는 중...
            </span>
          ) : selected ? '한 번 더' : '발표자 뽑기'}
        </Button>
      </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {history.map((name, i) => (
            <span key={`${name}-${i}`} className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-medium text-slate-500 dark:text-slate-400">
              {i + 1}. {name.nickname}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
