import { useState, useCallback, useRef, useMemo, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import './LargeDisplayGames.css';
import { Gift, Trophy, Monitor } from 'lucide-react';
import Button from '@/components/ui/Button';
import { buildScratchBoard, ROW_LINES, CELL_COUNT } from '@/lib/scratch';
import { useDrawDisplay, drawPrimary, drawSecondary } from '@/lib/draw-display';
import { useGameMirror } from '../api/useGameMirror';
import { hapticSuccess } from '@/lib/haptics';
import DrawDisplayToggle from './DrawDisplayToggle';
import ScratchCell from './ScratchCell';
import { getServerNow } from '@/features/timer/api/useTimer';

const ConfettiBurst = lazy(() => import('@/components/ui/ConfettiBurst'));

const EMPTY = { serial: 0, cells: null, winningRow: 0, revealed: [], won: false, past: [] };

/**
 * ScratchCard — 즉석복권 추첨.
 *
 * 한 판에 한 명이 당첨된다. 가로 세 줄 중 한 줄에만 같은 사람 3칸이 들어 있고, 그 줄이 드러나는
 * 순간이 발표다(lib/scratch.js가 다른 줄에 3개 일치가 생기지 않도록 보장).
 * 칸을 누르면 동전이 알아서 긁는다 — 프로젝터 앞에서 아홉 칸을 문지르게 할 수는 없다.
 *
 * role='control'(강사 화면)만 판을 깔고 긁는다. role='view'(전자칠판)는 그 상태를 받아
 * 같은 순서로 동전을 재생만 한다 — 관객이 보는 화면과 강사가 부르는 결과가 어긋나지 않게.
 */
export default function ScratchCard({ participants = [], onResult, presenter = false, sessionId, role = 'control' }) {
  const reduced = useReducedMotion();
  const isView = role === 'view';
  const { remote, publish } = useGameMirror(sessionId, { role, mode: 'scratchCard' });

  const [localState, setLocalState] = useState(EMPTY);
  const [active, setActive] = useState(null);      // 지금 동전이 훑는 칸(한 번에 하나)
  const [activeStartedAt, setActiveStartedAt] = useState(null);
  const [mirrorError, setMirrorError] = useState(false);
  const [sharing, setSharing] = useState(false);
  const mountedRef = useRef(true);
  const roundRef = useRef(0);
  const [storedDisplayMode, setDisplayMode] = useDrawDisplay();
  const displayMode = isView ? remote?.displayMode || storedDisplayMode : storedDisplayMode;
  const publishedRef = useRef(false);

  const state = isView ? (remote || EMPTY) : localState;
  const cells = state.cells;
  const winner = cells ? cells[ROW_LINES[state.winningRow][0]] : null;
  const hasEmployeeIds = useMemo(
    () => (cells || participants).some((p) => p?.employeeId),
    [cells, participants]
  );

  /** 직전 당첨자는 빼고 판을 깐다 — 같은 사람이 연달아 나오면 추첨으로 보이지 않는다. */
  const pool = useMemo(() => {
    const past = localState.past || [];
    const rest = participants.filter((p) => !past.some((w) => w.id === p.id));
    return rest.length > 0 ? rest : participants;
  }, [participants, localState.past]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; roundRef.current += 1; };
  }, []);
  // 긁기 시작부터 함께 재생한다. 확정 상태는 finish가 쓰기 응답을 확인한 뒤 결과를 발행한다.
  useEffect(() => {
    if (isView || !localState.cells || localState.won) return;
    publish({ ...localState, activeIndex: active, activeStartedAt, displayMode });
  }, [isView, localState, active, activeStartedAt, publish, displayMode]);
  const revealedSet = useMemo(() => new Set(state.revealed || []), [state.revealed]);
  const won = Boolean(state.won) && !sharing && !mirrorError;

  const finish = useCallback(async () => {
    if (isView || publishedRef.current || !winner) return;
    publishedRef.current = true;
    const round = roundRef.current;
    const nextState = { ...localState, displayMode, won: true, activeIndex: null, activeStartedAt: null,
      revealed: Array.from({ length: CELL_COUNT }, (_, i) => i), past: [...(localState.past || []), winner] };
    setActive(null);
    setActiveStartedAt(null);
    setSharing(true);
    setLocalState({ ...nextState, past: localState.past || [] });
    const synchronized = await publish(nextState);
    if (!mountedRef.current || roundRef.current !== round) return;
    setSharing(false);
    if (!synchronized) { setMirrorError(true); setLocalState({ ...nextState, past: localState.past || [] }); return; }
    setLocalState(nextState);
    hapticSuccess();
    onResult?.([{ id: winner.id, nickname: winner.nickname, ...(winner.employeeId ? { employeeId: winner.employeeId } : {}) }]);
  }, [isView, winner, onResult, localState, publish, displayMode]);

  const handleRevealed = useCallback((index) => {
    if (isView || !mountedRef.current) return;
    setActive(null);
    setActiveStartedAt(null);
    setLocalState((prev) => {
      const revealed = prev.revealed.includes(index) ? prev.revealed : [...prev.revealed, index];
      return { ...prev, revealed };
    });
  }, [isView]);

  // 당첨 줄이 다 열렸는지 판정 — 마지막 칸이 열린 다음 렌더에서 확인한다
  useEffect(() => {
    if (isView || !localState.cells || localState.won) return;
    if (ROW_LINES[localState.winningRow].every((i) => localState.revealed.includes(i))) finish();
  }, [isView, localState, finish]);

  const startScratch = useCallback((index) => {
    if (isView || active !== null || sharing || revealedSet.has(index)) return;
    setActiveStartedAt(getServerNow());
    setActive(index);
  }, [isView, active, sharing, revealedSet]);

  function dealBoard() {
    if (isView || active !== null || sharing) return;
    const next = buildScratchBoard(pool);
    if (!next) return;
    publishedRef.current = false;
    setActive(null);
    setActiveStartedAt(null);
    setMirrorError(false);
    setSharing(false);
    roundRef.current += 1;
    const serial = getServerNow();
    setLocalState((prev) => ({
      serial: Math.max(serial, prev.serial + 1),
      cells: next.cells,
      winningRow: next.winningRow,
      revealed: [],
      won: false,
      past: prev.past || [],
    }));
  }

  if (!isView && participants.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <Gift size={presenter ? 48 : 36} className="text-slate-300 dark:text-slate-600" />
        <p className={`text-slate-400 ${presenter ? 'text-2xl' : 'text-base'}`}>추첨할 명단이 없습니다</p>
      </div>
    );
  }

  const boardShell = presenter ? 'gap-3 p-4' : 'gap-2 p-3';
  const cellShell = presenter ? 'w-[clamp(160px,13vw,280px)] h-[clamp(88px,12dvh,160px)]' : 'w-[clamp(64px,20vw,112px)] h-[clamp(64px,18vw,96px)]';

  return (
    <div data-presenter={presenter} className={`scratch-stage flex flex-col items-center ${presenter ? 'gap-6' : 'gap-4'}`}>
      <div className="text-center space-y-1">
        <h3 className={`scratch-title font-black tracking-tight text-slate-900 dark:text-slate-100 ${presenter ? 'text-4xl' : 'text-2xl'}`}>
          즉석복권
        </h3>
        <p role={active !== null || sharing ? 'status' : undefined} className={`text-slate-400 ${presenter ? 'text-lg' : 'text-sm'}`}>
          {!cells && (isView ? '강사 화면에서 판을 깔면 여기에 그대로 나옵니다' : '판을 깔고 칸을 눌러보세요')}
          {cells && !won && (mirrorError ? '결과 공유를 기다리고 있어요' : sharing ? '당첨 결과를 전자칠판과 공유하고 있어요'
            : active !== null ? `${active + 1}번 칸을 긁고 있어요 · 잠시 후 다음 칸을 눌러주세요`
              : isView ? '강사 화면에서 긁는 중' : '칸을 누르면 동전이 긁습니다. 한 줄 3칸이 같은 사람이면 당첨')}
          {won && winner && (
            <span className="inline-flex items-center gap-2">
              <Trophy size={presenter ? 22 : 15} className="text-amber-500" />
              <span className={`scratch-winner-name font-bold text-slate-900 dark:text-slate-100 tabular-nums ${presenter ? "text-[clamp(30px,2.8vw,52px)]" : ""}`}>
                {drawPrimary(winner, displayMode)}
              </span>
              {drawSecondary(winner, displayMode) && (
                <span className="tabular-nums">{drawSecondary(winner, displayMode)}</span>
              )}
              <span>당첨</span>
            </span>
          )}
        </p>
      </div>

      {!isView && hasEmployeeIds && <DrawDisplayToggle mode={displayMode} onChange={setDisplayMode} presenter={presenter} />}

      <AnimatePresence mode="wait">
        {cells ? (
          <motion.div
            key={`board-${state.serial}`}
            initial={{ opacity: 0, scale: reduced ? 1 : 0.94, y: reduced ? 0 : 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: reduced ? 1 : 0.96 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className={`scratch-board relative flex flex-col ${presenter ? 'gap-4' : 'gap-3'}`}
          >
            {won && !reduced && <Suspense fallback={null}><ConfettiBurst /></Suspense>}
            {/* 줄 단위로 끊어 놓는다 — 당첨 판정이 '가로 한 줄'이라 눈에도 줄로 보여야 한다. */}
            {ROW_LINES.map((line, rowIndex) => (
              <motion.div
                key={`row-${rowIndex}`}
                animate={{
                  scale: !reduced && won && rowIndex === state.winningRow ? 1.025 : 1,
                  opacity: won && rowIndex !== state.winningRow ? 0.5 : 1,
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                className={`scratch-row grid grid-cols-3 rounded-3xl ring-1 shadow-sm ${boardShell} ${
                  won && rowIndex === state.winningRow
                    ? 'ring-amber-400 bg-amber-50 dark:bg-amber-500/10 shadow-lg shadow-amber-500/10'
                    : 'ring-slate-200 dark:ring-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                {line.map((index) => (
                  <ScratchCell
                    key={`${state.serial}-${index}`}
                    primary={drawPrimary(cells[index], displayMode)}
                    secondary={drawSecondary(cells[index], displayMode)}
                    index={index}
                    revealed={revealedSet.has(index)}
                    scratching={isView ? state.activeIndex === index : active === index}
                    startedAt={isView ? state.activeStartedAt : activeStartedAt}
                    highlight={won && rowIndex === state.winningRow}
                    interactive={!isView}
                    disabled={active !== null || sharing}
                    presenter={presenter}
                    onScratch={startScratch}
                    onRevealed={handleRevealed}
                  />
                ))}
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="empty-board"
            initial={{ opacity: 0, y: reduced ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`scratch-board flex flex-col ${presenter ? 'gap-4' : 'gap-3'}`}
          >
            {ROW_LINES.map((line, rowIndex) => (
              <div
                key={`placeholder-row-${rowIndex}`}
                className={`scratch-row grid grid-cols-3 rounded-3xl bg-slate-50 dark:bg-slate-800/60 ring-1 ring-dashed ring-slate-200 dark:ring-slate-700 ${boardShell}`}
              >
                {line.map((i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: 0.5 }}
                    className={`scratch-cell rounded-2xl bg-slate-200 dark:bg-slate-700 ${cellShell}`}
                  />
                ))}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {isView ? (
        <p className="scratch-meta inline-flex items-center gap-1.5 text-slate-400 text-sm">
          <Monitor size={14} />
          강사 화면을 그대로 보여주는 중입니다
        </p>
      ) : (
        <Button onClick={dealBoard} variant="primary" size={presenter ? 'lg' : 'md'} disabled={active !== null || sharing}>
          <Gift size={presenter ? 22 : 18} />
          {cells ? '새 복권 긁기' : '복권 시작하기'}
        </Button>
      )}

      {mirrorError && !isView && <p role="alert" className="text-sm text-red-300">전자칠판 연결을 확인해주세요. 결과 알림은 아직 보내지 않았어요.</p>}
      {(state.past || []).length > 0 && (
        <p className={`scratch-past text-slate-400 ${presenter ? 'text-base' : 'text-xs'}`}>
          지난 당첨{' '}
          <span className="text-slate-600 dark:text-slate-300 font-medium tabular-nums">
            {state.past.map((w) => drawPrimary(w, displayMode)).join(' · ')}
          </span>
        </p>
      )}
    </div>
  );
}
