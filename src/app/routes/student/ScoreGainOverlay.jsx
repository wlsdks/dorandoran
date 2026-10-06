import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, animate, useMotionValue, useTransform, useReducedMotion } from 'framer-motion';
import { useMyScore } from '@/features/quiz/api/useScores';
import { useRealtimeValue } from '@/hooks/useRealtimeValue';
import { getParticipantId } from '@/lib/participant';
import { hapticTap } from '@/lib/haptics';
import { spring, ease, exitTween, count } from '@/lib/motion';
import {
  INITIAL_GAIN_STATE, GAIN_SHOW_MS, GAIN_COUNT_MS, LOSS_SHOW_MS, observeScore, trackConnection, mergeGain,
  describeGain, describeLoss, withOwnVote, isBigGain, formatSigned, gainAnnouncement, holdGain, releaseGain,
} from '@/lib/score-gain';

/**
 * 본인 점수 노드(헤더와 같은 구독)에서 화면을 보는 동안 생긴 변화만 장면으로 만든다.
 * 두구두구 막(session.drumroll, z-80)이 내려와 있으면 들고 있다가 막이 걷힐 때 보여준다.
 */
function useScoreScene(sessionId, participantId) {
  const { myScore, loading, error } = useMyScore(sessionId);
  const { value: connected } = useRealtimeValue('.info/connected');
  const { value: drumroll } = useRealtimeValue(sessionId ? `sessions/${sessionId}/drumroll` : null);
  const stateRef = useRef(INITIAL_GAIN_STATE);
  const heldRef = useRef(null);
  const curtainRef = useRef(false);
  const [scene, setScene] = useState(null);
  useEffect(() => { stateRef.current = INITIAL_GAIN_STATE; heldRef.current = null; setScene(null); }, [sessionId, participantId]);
  useEffect(() => { stateRef.current = trackConnection(stateRef.current, connected); }, [connected]);
  useEffect(() => {
    curtainRef.current = Boolean(drumroll);
    if (curtainRef.current) return;
    const released = releaseGain(heldRef.current);
    heldRef.current = null;
    if (released) setScene(current => mergeGain(current, released));
  }, [drumroll]);
  useEffect(() => {
    const { state, event } = observeScore(stateRef.current, { loading, error, value: myScore });
    stateRef.current = state;
    if (!event) return;
    if (curtainRef.current) heldRef.current = holdGain(heldRef.current, event);
    else setScene(current => mergeGain(current, event));
  }, [myScore, loading, error]);
  const dismiss = useCallback(() => setScene(null), []);
  return { scene, dismiss };
}

/** 사유 라벨 재료 — 학생이 읽을 수 있는 공개 문항 + 내 투표만. 정답 공개가 도착해야 라벨이 생긴다. */
function useGainLabel(sessionId, participantId, scene) {
  const questionId = scene?.score?.lastQuestionId;
  const base = sessionId && questionId ? `sessions/${sessionId}` : null;
  const { value: publicQuestion } = useRealtimeValue(base ? `${base}/publicQuestions/${questionId}` : null);
  const { value: vote } = useRealtimeValue(base && participantId ? `${base}/questions/${questionId}/votes/${participantId}` : null);
  return useMemo(() => {
    if (!scene) return null;
    const question = withOwnVote(publicQuestion, participantId, vote);
    return scene.delta > 0 ? describeGain(scene, question, participantId) : describeLoss(scene, question, participantId);
  }, [scene, publicQuestion, vote, participantId]);
}

/** 총점 카운트업 — 현재 표시 값에서 이어가므로 합쳐진 장면도 끊기지 않는다. */
function CountUp({ from, to, delay, reduced }) {
  const value = useMotionValue(from);
  const text = useTransform(value, current => Math.round(current).toLocaleString('ko-KR'));
  useEffect(() => {
    if (reduced) { value.set(to); return; }
    // 숫자는 count.score(0.45s)로 센다 — 장면(GAIN_SHOW_MS) 안에서 읽을 시간이 남는다
    const control = animate(value, to, { duration: Math.min(GAIN_COUNT_MS / 1000, count.score.duration), delay, ease: count.score.ease });
    return () => control.stop();
  }, [value, to, delay, reduced]);
  return <motion.span>{text}</motion.span>;
}

/** 큰 점수·연속 정답 — 숫자를 중심으로 가는 빛줄기 8개와 고리 하나가 한 번 퍼진다(색종이 없음). */
function LightBurst() {
  return <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
    {Array.from({ length: 8 }, (_, index) => <motion.span key={index}
      className="absolute bottom-1/2 h-60 w-px origin-bottom bg-[linear-gradient(to_top,transparent_40%,var(--color-indigo-400)_68%,transparent_100%)] dark:bg-[linear-gradient(to_top,transparent_40%,var(--color-indigo-300)_68%,transparent_100%)]"
      style={{ rotate: index * 45 }}
      initial={{ scaleY: 0.3, opacity: 0 }} animate={{ scaleY: [0.3, 1, 1.08], opacity: [0, 0.85, 0] }}
      transition={{ duration: 0.7, delay: 0.1 + index * 0.012, ease: ease.out }} />)}
    <motion.span className="absolute h-40 w-40 rounded-full border border-indigo-400/40 dark:border-indigo-300/40"
      initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: [0.4, 1.9], opacity: [0, 0.6, 0] }} transition={{ duration: 0.75, delay: 0.08, ease: ease.out }} />
  </div>;
}

function GainScene({ scene, label, reduced, onDismiss }) {
  const big = isBigGain(scene.delta, scene.score?.streak);
  const fade = { duration: reduced ? 0.12 : 0.18 };
  const settle = delay => reduced ? fade : { ...spring.default, delay };
  return <motion.div role="presentation" onPointerDown={onDismiss}
    className="fixed inset-0 z-[60] flex cursor-default select-none flex-col items-center justify-center bg-white/60 px-6 backdrop-blur-md dark:bg-slate-950/65"
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: exitTween }} transition={fade}>
    {/* 빛과 번짐은 숫자 상자를 기준으로 — 화면 중앙이 아니라 "+147" 뒤에 놓인다. */}
    <div className="relative flex items-center justify-center">
      <motion.div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/20 blur-3xl dark:bg-indigo-400/20" aria-hidden="true"
        initial={{ opacity: 0, scale: reduced ? 1 : 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={reduced ? fade : { duration: 0.5, ease: ease.out }} />
      {big && !reduced && <LightBurst />}
      <motion.p key={scene.id} className="relative text-[88px] font-bold leading-none tracking-[-0.045em] tabular-nums text-slate-900 dark:text-slate-50"
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.55, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={reduced ? fade : { ...spring.bouncy, opacity: { duration: 0.12 } }}>
        {formatSigned(scene.delta)}
      </motion.p>
    </div>
    <AnimatePresence initial={false}>
      {label && <motion.p key="label" className="relative mt-3 text-[15px] font-medium text-slate-600 dark:text-slate-300"
        initial={{ opacity: 0, y: reduced ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: exitTween }} transition={settle(0.12)}>{label}</motion.p>}
    </AnimatePresence>
    <motion.div className="relative mt-9 flex items-baseline gap-2 text-slate-500 dark:text-slate-400"
      initial={{ opacity: 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={settle(0.18)}>
      <span className="text-sm">내 점수</span>
      <span className="text-3xl font-semibold tabular-nums text-slate-900 dark:text-slate-100"><CountUp from={scene.from} to={scene.to} delay={0.22} reduced={reduced} />점</span>
    </motion.div>
  </motion.div>;
}

/** 감점은 흐림 없이 작은 알림만 — 입력을 막지 않는다. */
function LossScene({ scene, label, reduced }) {
  return <motion.div className="pointer-events-none fixed inset-x-0 top-24 z-[60] flex justify-center px-6"
    initial={{ opacity: 0, y: reduced ? 0 : -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: exitTween }} transition={reduced ? { duration: 0.12 } : spring.default}>
    <p className="flex items-baseline gap-2 rounded-full bg-slate-900/90 px-4 py-2 text-white shadow-lg dark:bg-slate-100/95 dark:text-slate-900">
      <span className="text-lg font-semibold tabular-nums">{formatSigned(scene.delta)}</span>
      {label && <span className="text-xs font-medium opacity-80">{label}</span>}
    </p>
  </motion.div>;
}

/** 학생 셸에 한 번만 붙인다. 점수가 오르면 전체 화면 장면, 내리면 조용한 알림. 탭·Esc·시간으로 닫힌다. */
export default memo(function ScoreGainOverlay({ sessionId }) {
  const participantId = getParticipantId();
  const { scene, dismiss } = useScoreScene(sessionId, participantId);
  const label = useGainLabel(sessionId, participantId, scene);
  const reduced = useReducedMotion();
  const sceneId = scene?.id;
  const gain = scene?.delta > 0;
  useEffect(() => { if (sceneId && gain) hapticTap(); }, [sceneId, gain]);
  useEffect(() => {
    if (!scene) return;
    const timer = setTimeout(dismiss, gain ? GAIN_SHOW_MS : LOSS_SHOW_MS);
    const onKey = event => { if (event.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(timer); window.removeEventListener('keydown', onKey); };
  }, [scene, gain, dismiss]);
  if (typeof document === 'undefined') return null;
  return createPortal(<>
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{gainAnnouncement(scene)}</div>
    <AnimatePresence>
      {scene && (gain
        ? <GainScene key="gain" scene={scene} label={label} reduced={reduced} onDismiss={dismiss} />
        : <LossScene key="loss" scene={scene} label={label} reduced={reduced} />)}
    </AnimatePresence>
  </>, document.body);
});
