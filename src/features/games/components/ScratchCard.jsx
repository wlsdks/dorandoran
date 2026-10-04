import { useState, useCallback, useRef, useMemo, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Trophy, Monitor } from 'lucide-react';
import Button from '@/components/ui/Button';
import { buildScratchBoard, ROW_LINES, CELL_COUNT } from '@/lib/scratch';
import { useDrawDisplay, drawPrimary, drawSecondary } from '@/lib/draw-display';
import { useGameMirror } from '../api/useGameMirror';
import { hapticSuccess } from '@/lib/haptics';
import DrawDisplayToggle from './DrawDisplayToggle';
import ScratchCell from './ScratchCell';

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
  const isView = role === 'view';
  const { remote, publish } = useGameMirror(sessionId, { role, mode: 'scratchCard' });

  const [localState, setLocalState] = useState(EMPTY);
  const [active, setActive] = useState(null);      // 지금 동전이 훑는 칸(한 번에 하나)
  const [played, setPlayed] = useState(() => new Set()); // 전자칠판에서 이미 재생한 칸
  const [displayMode, setDisplayMode] = useDrawDisplay();
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

  // 강사 화면의 상태 변화를 전자칠판으로 흘려보낸다
  useEffect(() => {
    if (isView || !localState.cells) return;
    publish(localState);
  }, [isView, localState, publish]);

  // 새 판이 오면 전자칠판의 재생 기록을 비운다
  useEffect(() => {
    if (!isView) return;
    setPlayed(new Set());
  }, [isView, remote?.serial]);

  const revealedSet = useMemo(() => new Set(state.revealed || []), [state.revealed]);
  const rowPlayed = useMemo(
    () => ROW_LINES[state.winningRow].every((i) => played.has(i)),
    [played, state.winningRow]
  );
  // 전자칠판은 동전이 그 줄을 다 지나간 뒤에 축하한다 — 미리 터지면 김이 샌다
  const won = isView ? (state.won && rowPlayed) : localState.won;

  const finish = useCallback(() => {
    if (publishedRef.current || !winner) return;
    publishedRef.current = true;
    hapticSuccess();
    onResult?.([{ id: winner.id, nickname: winner.nickname, ...(winner.employeeId ? { employeeId: winner.employeeId } : {}) }]);
    setActive(null);
    setLocalState((prev) => ({
      ...prev,
      won: true,
      // 당첨 줄이 드러나면 나머지 칸도 곧 열어 보여준다 — 확인은 시키되 기다리게 하지 않는다
      revealed: Array.from({ length: CELL_COUNT }, (_, i) => i),
      past: [...(prev.past || []), winner],
    }));
  }, [winner, onResult]);

  const handleRevealed = useCallback((index) => {
    if (isView) {
      setPlayed((prev) => new Set(prev).add(index));
      return;
    }
    setActive(null);
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
    if (isView || active !== null || revealedSet.has(index)) return;
    setActive(index);
  }, [isView, active, revealedSet]);

  function dealBoard() {
    const next = buildScratchBoard(pool);
    if (!next) return;
    publishedRef.current = false;
    setActive(null);
    setLocalState((prev) => ({
      serial: prev.serial + 1,
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
  const cellShell = presenter ? 'w-36 h-28 md:w-44 md:h-32' : 'w-24 h-20 sm:w-28 sm:h-24';

  return (
    <div className={`flex flex-col items-center ${presenter ? 'gap-6' : 'gap-4'}`}>
      <div className="text-center space-y-1">
        <h3 className={`font-black tracking-tight text-slate-900 dark:text-slate-100 ${presenter ? 'text-4xl' : 'text-2xl'}`}>
          즉석복권
        </h3>
        <p className={`text-slate-400 ${presenter ? 'text-lg' : 'text-sm'}`}>
          {!cells && (isView ? '강사 화면에서 판을 깔면 여기에 그대로 나옵니다' : '판을 깔고 칸을 눌러보세요')}
          {cells && !won && (isView ? '강사 화면에서 긁는 중' : '칸을 누르면 동전이 긁습니다. 한 줄 3칸이 같은 사람이면 당첨')}
          {won && winner && (
            <span className="inline-flex items-center gap-2">
              <Trophy size={presenter ? 22 : 15} className="text-amber-500" />
              <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
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

      {hasEmployeeIds && <DrawDisplayToggle mode={displayMode} onChange={setDisplayMode} presenter={presenter} />}

      <AnimatePresence mode="wait">
        {cells ? (
          <motion.div
            key={`board-${state.serial}`}
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className={`relative flex flex-col ${presenter ? 'gap-4' : 'gap-3'}`}
          >
            {won && <Suspense fallback={null}><ConfettiBurst /></Suspense>}
            {/* 줄 단위로 끊어 놓는다 — 당첨 판정이 '가로 한 줄'이라 눈에도 줄로 보여야 한다. */}
            {ROW_LINES.map((line, rowIndex) => (
              <motion.div
                key={`row-${rowIndex}`}
                animate={{
                  scale: won && rowIndex === state.winningRow ? 1.03 : 1,
                  opacity: won && rowIndex !== state.winningRow ? 0.5 : 1,
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                className={`grid grid-cols-3 rounded-3xl ring-1 shadow-sm ${boardShell} ${
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
                    revealed={isView ? played.has(index) : revealedSet.has(index)}
                    scratching={isView ? (revealedSet.has(index) && !played.has(index)) : active === index}
                    highlight={won && rowIndex === state.winningRow}
                    interactive={!isView}
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`flex flex-col ${presenter ? 'gap-4' : 'gap-3'}`}
          >
            {ROW_LINES.map((line, rowIndex) => (
              <div
                key={`placeholder-row-${rowIndex}`}
                className={`grid grid-cols-3 rounded-3xl bg-slate-50 dark:bg-slate-800/60 ring-1 ring-dashed ring-slate-200 dark:ring-slate-700 ${boardShell}`}
              >
                {line.map((i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.35, 0.6, 0.35] }}
                    transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.08, ease: 'easeInOut' }}
                    className={`rounded-2xl bg-slate-200 dark:bg-slate-700 ${cellShell}`}
                  />
                ))}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {isView ? (
        <p className="inline-flex items-center gap-1.5 text-slate-400 text-sm">
          <Monitor size={14} />
          강사 화면을 그대로 보여주는 중입니다
        </p>
      ) : (
        <Button onClick={dealBoard} variant="primary" size={presenter ? 'lg' : 'md'} disabled={active !== null}>
          <Gift size={presenter ? 22 : 18} />
          {cells ? '새 복권 긁기' : '복권 시작하기'}
        </Button>
      )}

      {(state.past || []).length > 0 && (
        <p className={`text-slate-400 ${presenter ? 'text-base' : 'text-xs'}`}>
          지난 당첨{' '}
          <span className="text-slate-600 dark:text-slate-300 font-medium tabular-nums">
            {state.past.map((w) => drawPrimary(w, displayMode)).join(' · ')}
          </span>
        </p>
      )}
    </div>
  );
}
