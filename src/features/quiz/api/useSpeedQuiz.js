import { ref, onValue, update, set, remove, runTransaction, increment } from 'firebase/database';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { isQuizQuestion, getQuizReward } from '@/lib/quiz';
import { logger } from '@/lib/logger';
import { getServerNow } from '@/features/timer/api/useTimer';

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
export function useSpeedQuiz(sessionId, session, { scores, participants, startTimer, stopTimer }) {
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | question | reveal | done
  const phaseTimerRef = useRef(null);
  const advancingRef = useRef(false); // prevent double-fire
  const sessionRef = useRef(session);
  const scoresRef = useRef(scores);
  const participantsRef = useRef(participants);

  // Keep refs up to date
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { scoresRef.current = scores; }, [scores]);
  useEffect(() => { participantsRef.current = participants; }, [participants]);

  // Listen for speedQuiz state from Firebase
  useEffect(() => {
    if (!sessionId) return;
    const speedRef = ref(db, `sessions/${sessionId}/speedQuiz`);
    const unsub = onValue(speedRef, (snap) => {
      const data = snap.val();
      setActive(data?.active === true);
    });
    return () => unsub();
  }, [sessionId]);

  // Cleanup phase timer on unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
    mountedRef.current = false;
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
    if (advancingRef.current) return; // prevent double-fire
    advancingRef.current = true;

    const currentQId = sessionRef.current?.currentQuestion;
    const question = sessionRef.current?.questions?.[currentQId];
    if (!currentQId || !question || !isQuizQuestion(question)) {
      advancingRef.current = false;
      return;
    }

    try {
      const now = getServerNow(); // revealedAt/awardedAt도 서버 기준으로 통일
      const voteEntries = Object.entries(question.votes || {});
      const updates = {
        currentMode: 'quiz',
        [`questions/${currentQId}/revealedAt`]: now,
      };

      // awardedAt 트랜잭션 선점 — 다중 기기 동시 리빌 시 이중 지급 방지 (revealQuiz와 동일 정책)
      let iAward = false;
      if (!question.awardedAt) {
        const claim = await runTransaction(
          ref(db, `sessions/${sessionId}/questions/${currentQId}/awardedAt`),
          (cur) => (cur ? undefined : now)
        );
        iAward = claim.committed;
      }
      if (iAward) {
        const currentScores = scoresRef.current;
        const currentParticipants = participantsRef.current;

        voteEntries.forEach(([participantId, vote]) => {
          const reward = getQuizReward(question, vote);
          const existingScore = currentScores[participantId] || {};
          const nextStreak = reward.isCorrect ? (existingScore.streak || 0) + 1 : 0;
          const nickname = currentParticipants[participantId]?.nickname ||
            vote.nickname || existingScore.nickname || `P${participantId.slice(0, 4)}`;

          // Apply combo multiplier for speed quiz streaks
          const comboMultiplier = getComboMultiplier(nextStreak);
          const boostedPoints = Math.round(reward.points * comboMultiplier);

          // total/tickets는 원자 increment — 동시 지급(스포트라이트 등) 유실 방지
          updates[`scores/${participantId}/total`] = increment(boostedPoints);
          updates[`scores/${participantId}/tickets`] = increment(reward.tickets);
          updates[`scores/${participantId}/nickname`] = nickname;
          updates[`scores/${participantId}/lastPoints`] = boostedPoints;
          updates[`scores/${participantId}/lastTickets`] = reward.tickets;
          updates[`scores/${participantId}/streak`] = nextStreak;
          updates[`scores/${participantId}/bestStreak`] = Math.max(existingScore.bestStreak || 0, nextStreak);
          updates[`scores/${participantId}/lastQuestionId`] = currentQId;
          updates[`scores/${participantId}/updatedAt`] = now;
        });
      }

      // Stop the timer and apply updates
      await stopTimer();
      await update(ref(db, `sessions/${sessionId}`), updates);
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
        if (!mountedRef.current) return;
        if (nextQ) {
          await activateQuizQuestion(nextQ[0]);
        } else {
          // All quiz questions done, show leaderboard
          try {
            await update(ref(db, `sessions/${sessionId}`), { currentMode: 'leaderboard' });
            if (mountedRef.current) setPhase('done');
            // End speed quiz after leaderboard is shown
            phaseTimerRef.current = setTimeout(async () => {
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
    }
    // endSpeedQuizInternal은 같은 hook 내 함수 — 의도적 omit (recursive 호출이라 dep 추가 시 매 render 재생성)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, stopTimer, getQuizQuestions, activateQuizQuestion]);

  // Watch the timer and auto-fire when it expires during speed quiz
  useEffect(() => {
    if (!active || phase !== 'question') return;

    const timerRef = ref(db, `sessions/${sessionId}/timer`);
    const unsub = onValue(timerRef, (snap) => {
      const data = snap.val();
      if (!data?.endTime || !data?.running) return;

      const remaining = data.endTime - getServerNow();
      if (remaining <= 0) {
        // Timer expired, trigger reveal+advance
        revealAndAdvance();
      }
    });
    return () => unsub();
  }, [active, phase, sessionId, revealAndAdvance]);

  // Also set a local setTimeout as backup for auto-advance
  useEffect(() => {
    if (!active || phase !== 'question') return;

    const timer = sessionRef.current?.timer || {};
    if (!timer || !timer.endTime) return;

    // 서버 시간 기준 remaining — 강사 기기 시계와 endTime 기준(서버)이 어긋나도 정확.
    const remaining = Math.max(0, timer.endTime - getServerNow()) + 500; // +500ms buffer
    const id = setTimeout(() => {
      if (phase === 'question') {
        revealAndAdvance();
      }
    }, remaining);

    return () => clearTimeout(id);
  }, [active, phase, revealAndAdvance]);

  // Start speed quiz mode
  const startSpeedQuiz = useCallback(async () => {
    const quizQs = getQuizQuestions();
    if (quizQs.length === 0) return;

    try {
      await set(ref(db, `sessions/${sessionId}/speedQuiz`), {
        active: true,
        startedAt: Date.now(),
        totalQuestions: quizQs.length,
      });
      // Activate first quiz question
      await activateQuizQuestion(quizQs[0][0]);
    } catch (e) {
      logger.error('Speed quiz: start failed', e);
    }
  }, [sessionId, getQuizQuestions, activateQuizQuestion]);


  // End speed quiz mode (called by admin button)
  const endSpeedQuiz = useCallback(async () => {
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
  const quizCount = quizQuestions.length;
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
  if (streak >= 5) return 1.5;
  if (streak >= 3) return 1.2;
  return 1;
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
