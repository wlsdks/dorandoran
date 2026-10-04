import { ref, onValue, update, set, remove, get } from 'firebase/database';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { isQuizQuestion } from '@/lib/quiz';
import { logger } from '@/lib/logger';
import { getServerNow } from '@/features/timer/api/useTimer';
import { awardQuizRound, quizComboMultiplier } from '@/lib/quiz-awards';

const SPEED_QUIZ_TIMER = 10; // seconds per question
const REVEAL_PAUSE = 3500;   // ms to show answer before next question

/**
 * useSpeedQuiz — auto-advance quiz engine for admin.
 * When speed mode is active, it:
 * 1. Starts a 10s timer for each quiz question
 * 2. After timer expires, auto-reveals the answer and awards scores
 * 3. After a 3.5s pause, auto-advances to the next quiz question
 * 4. At the end, shows the leaderboard
 */
export function useSpeedQuiz(sessionId, session, { startTimer, stopTimer }) {
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | question | reveal | done
  const phaseTimerRef = useRef(null);
  const advancingRef = useRef(false); // prevent double-fire
  const sessionRef = useRef(session);
  const runEpochRef = useRef(0);
  const activeRef = useRef(false);
  const observedRunRef = useRef(null);

  // Keep refs up to date
  useEffect(() => { sessionRef.current = session; }, [session]);

  // Listen for speedQuiz state from Firebase
  useEffect(() => {
    if (!sessionId) return;
    const speedRef = ref(db, `sessions/${sessionId}/speedQuiz`);
    let subscribed = true;
    const unsub = onValue(speedRef, (snap) => {
      if (!subscribed) return;
      const data = snap.val();
      const run = data?.active === true ? (data.startedAt ?? 'legacy-active') : null;
      if (run !== observedRunRef.current) {
        observedRunRef.current = run;
        runEpochRef.current += 1;
        advancingRef.current = false;
      }
      activeRef.current = data?.active === true;
      setActive(activeRef.current);
      if (!activeRef.current) {
        if (phaseTimerRef.current) { clearTimeout(phaseTimerRef.current); phaseTimerRef.current = null; }
        setPhase('idle');
      }
    });
    return () => { subscribed = false; observedRunRef.current = null; unsub(); };
  }, [sessionId]);

  // Cleanup phase timer on unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
    mountedRef.current = false;
    runEpochRef.current += 1;
    activeRef.current = false;
    if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    };
  }, [sessionId]);

  // Get quiz questions sorted by order
  const getQuizQuestions = useCallback(() => {
    const questions = sessionRef.current?.questions || {};
    return Object.entries(questions)
      .filter(([, q]) => isQuizQuestion(q))
      .sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
  }, []);

  // Find the current quiz question index (1-based) among quiz-type questions
  const _getCurrentQuizIndex = useCallback(() => {
    const quizQs = getQuizQuestions();
    const currentQId = sessionRef.current?.currentQuestion;
    if (!currentQId) return 0;
    const idx = quizQs.findIndex(([qId]) => qId === currentQId);
    return idx >= 0 ? idx + 1 : 0;
  }, [getQuizQuestions]);

  // Activate a quiz question with timer
  const activateQuizQuestion = useCallback(async (qId) => {
    // 서버 보정 시각 — 학생 vote.timestamp(serverTimestamp)와 동일 기준이라야 속도 보너스
    // (elapsedMs = vote.timestamp - activatedAt)가 강사 기기 시계 오차 없이 정확해짐.
    const now = getServerNow();
    try {
      await update(ref(db, `sessions/${sessionId}`), {
        currentQuestion: qId,
        currentMode: 'quiz',
        [`questions/${qId}/activatedAt`]: now,
        [`questions/${qId}/speedQuizRound`]: now,
        [`questions/${qId}/revealedAt`]: null,
        [`questions/${qId}/awardedAt`]: null,
      });
      await startTimer(SPEED_QUIZ_TIMER);
      setPhase('question');
      advancingRef.current = false;
    } catch (e) {
      logger.error('Speed quiz: activate failed', e);
      advancingRef.current = false;
    }
  }, [sessionId, startTimer]);

  // Internal end (no confirmation needed)
  const endSpeedQuizInternal = useCallback(async () => {
    runEpochRef.current += 1;
    activeRef.current = false;
    try {
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
      await remove(ref(db, `sessions/${sessionId}/speedQuiz`));
      setActive(false);
      setPhase('idle');
      advancingRef.current = false;
    } catch (e) {
      logger.error('Speed quiz: end failed', e);
    }
  }, [sessionId]);


  // Reveal the current question's answer and award scores
  const revealAndAdvance = useCallback(async () => {
    if (advancingRef.current || !activeRef.current) return; // prevent double-fire
    advancingRef.current = true;
    const runEpoch = runEpochRef.current;

    const currentQId = sessionRef.current?.currentQuestion;
    const question = sessionRef.current?.questions?.[currentQId];
    if (!currentQId || !question || !isQuizQuestion(question)) {
      advancingRef.current = false;
      return;
    }

    try {
      const result = await awardQuizRound(db, sessionId, currentQId, getServerNow());
      if (result.status === 'not-quiz') throw new Error('QUIZ_CHANGED');
      if (!mountedRef.current || runEpochRef.current !== runEpoch || !activeRef.current) return;
      await stopTimer();
      if (!mountedRef.current || runEpochRef.current !== runEpoch || !activeRef.current) return;
      setPhase('reveal');

      // Find next unrevealed quiz question
      const quizQs = getQuizQuestions();
      const currentIdx = quizQs.findIndex(([qId]) => qId === currentQId);
      let nextQ = null;
      for (let i = currentIdx + 1; i < quizQs.length; i++) {
        // Check the DB state, not the stale ref - we just set revealedAt on current
        if (quizQs[i][0] !== currentQId && !quizQs[i][1].revealedAt) {
          nextQ = quizQs[i];
          break;
        }
      }

      // After reveal pause, advance or finish
      phaseTimerRef.current = setTimeout(async () => {
        if (!mountedRef.current || runEpochRef.current !== runEpoch || !activeRef.current) return;
        // 다른 강사가 문항/모드를 바꾼 뒤 늦게 끝난 자동 진행이 그 화면을 덮지 않는다.
        let activeQuestion, activeMode;
        try {
          [activeQuestion, activeMode] = await Promise.all([
            get(ref(db, `sessions/${sessionId}/currentQuestion`)),
            get(ref(db, `sessions/${sessionId}/currentMode`)),
          ]);
        } catch (e) {
          if (!mountedRef.current || runEpochRef.current !== runEpoch) return;
          advancingRef.current = false;
          setPhase('idle');
          logger.error('Speed quiz: state check failed', e);
          return;
        }
        if (!mountedRef.current || runEpochRef.current !== runEpoch || !activeRef.current) return;
        if (activeQuestion.val() !== currentQId || activeMode.val() !== 'quiz') {
          advancingRef.current = false;
          setPhase('idle');
          return;
        }
        if (nextQ) {
          await activateQuizQuestion(nextQ[0]);
        } else {
          // All quiz questions done, show leaderboard
          try {
            await update(ref(db, `sessions/${sessionId}`), { currentMode: 'leaderboard' });
            if (mountedRef.current) setPhase('done');
            // End speed quiz after leaderboard is shown
            phaseTimerRef.current = setTimeout(async () => {
              if (!mountedRef.current || runEpochRef.current !== runEpoch || !activeRef.current) return;
              await endSpeedQuizInternal();
            }, 5000);
          } catch (e) {
            logger.error('Speed quiz: leaderboard failed', e);
          }
        }
      }, REVEAL_PAUSE);
    } catch (e) {
      logger.error('Speed quiz: reveal failed', e);
      advancingRef.current = false;
      if (mountedRef.current && runEpochRef.current === runEpoch && activeRef.current) await endSpeedQuizInternal();
    }
    // endSpeedQuizInternal은 같은 hook 내 함수 — 의도적 omit (recursive 호출이라 dep 추가 시 매 render 재생성)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, stopTimer, getQuizQuestions, activateQuizQuestion]);

  // Timer는 session metadata에 포함되지 않는다. timer leaf snapshot마다 실제 마감 시각을
  // 예약하고, 타이머 링이 만료 직후 endTime을 지워도 마지막 마감으로 공개를 완료한다.
  useEffect(() => {
    if (!active || phase !== 'question') return;
    const questionId = session?.currentQuestion;
    let subscribed = true;
    let deadline = null;
    let timeout = null;
    const fire = () => {
      if (!subscribed || !activeRef.current || sessionRef.current?.currentQuestion !== questionId) return;
      revealAndAdvance();
    };
    const unsubscribe = onValue(ref(db, `sessions/${sessionId}/timer`), snapshot => {
      if (!subscribed) return;
      if (timeout) clearTimeout(timeout);
      timeout = null;
      const data = snapshot.val();
      if (!data?.running || !Number.isFinite(data.endTime)) {
        // 수동으로 일찍 멈춘 경우는 취소. 자연 만료로 ring이 정리한 경우는 공개한다.
        if (Number.isFinite(deadline) && deadline <= getServerNow()) fire();
        deadline = null;
        return;
      }
      deadline = data.endTime;
      const remaining = deadline - getServerNow();
      if (remaining <= 0) fire();
      else timeout = setTimeout(fire, remaining);
    }, () => { if (timeout) clearTimeout(timeout); });
    return () => { subscribed = false; if (timeout) clearTimeout(timeout); unsubscribe(); };
  }, [active, phase, sessionId, session?.currentQuestion, revealAndAdvance]);

  // Start speed quiz mode
  const startSpeedQuiz = useCallback(async () => {
    runEpochRef.current += 1;
    activeRef.current = true;
    const quizQs = getQuizQuestions().filter(([, question]) => !question.revealedAt && !question.awardedAt);
    if (quizQs.length === 0) { activeRef.current = false; return; }

    try {
      await set(ref(db, `sessions/${sessionId}/speedQuiz`), {
        active: true,
        startedAt: Date.now(),
        totalQuestions: quizQs.length,
      });
      // Activate first quiz question
      await activateQuizQuestion(quizQs[0][0]);
    } catch (e) {
      activeRef.current = false;
      logger.error('Speed quiz: start failed', e);
    }
  }, [sessionId, getQuizQuestions, activateQuizQuestion]);


  // End speed quiz mode (called by admin button)
  const endSpeedQuiz = useCallback(async () => {
    runEpochRef.current += 1;
    activeRef.current = false;
    try {
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
      await stopTimer();
      await remove(ref(db, `sessions/${sessionId}/speedQuiz`));
      await update(ref(db, `sessions/${sessionId}`), {
        currentMode: 'waiting',
        currentQuestion: null,
      });
      setActive(false);
      setPhase('idle');
      advancingRef.current = false;
    } catch (e) {
      logger.error('Speed quiz: end failed', e);
    }
  }, [sessionId, stopTimer]);

  const quizQuestions = useMemo(() => Object.entries(session?.questions || {}).filter(([, question]) => isQuizQuestion(question))
    .sort((a, b) => (a[1].order || 0) - (b[1].order || 0)), [session?.questions]);
  const quizCount = active ? quizQuestions.length : quizQuestions.filter(([, question]) => !question.revealedAt && !question.awardedAt).length;
  const currentQuizIndex = quizQuestions.findIndex(([id]) => id === session?.currentQuestion) + 1;

  return {
    active,
    phase,
    startSpeedQuiz,
    endSpeedQuiz,
    quizCount,
    currentQuizIndex,
  };
}

/**
 * Combo multiplier — rewards consecutive correct answers in speed quiz.
 * 1-2 streak: 1x, 3-4 streak: 1.2x, 5+ streak: 1.5x
 */
export function getComboMultiplier(streak) {
  return quizComboMultiplier(streak);
}

/**
 * Get combo level for UI display.
 * Returns { level, multiplier, label }
 */
export function getComboLevel(streak) {
  if (streak >= 5) return { level: 3, multiplier: 1.5, label: 'MAX' };
  if (streak >= 3) return { level: 2, multiplier: 1.2, label: 'HOT' };
  if (streak >= 1) return { level: 1, multiplier: 1, label: '' };
  return { level: 0, multiplier: 1, label: '' };
}
