import { useRealtimeValue } from '@/hooks/useRealtimeValue';
import { EMPTY_RECORD } from '@/lib/realtime';
import { getStaffSession } from '@/lib/auth-session';
import { getParticipantId } from '@/lib/participant';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { ref, set, update, get, remove, serverTimestamp, runTransaction } from 'firebase/database';
import { ref as storageRef, deleteObject } from 'firebase/storage';
import { db } from '@/lib/firebase';
import { storage } from '@/lib/firebase-storage';
import { judgeLiveSubmission } from '@/lib/judging/geminiLive';
import { calculateLiveTop3 } from '@/lib/judging/awards';
import { JUDGE_THINKING_SNIPPETS } from '@/lib/judging/judges';
import { logger } from '@/lib/logger';

function pickThinking(judgeId) {
  const pool = JUDGE_THINKING_SNIPPETS[judgeId] || [];
  if (pool.length === 0) return '평가 준비 중...';
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Firebase Storage URL에서 storage 경로를 추출해 삭제.
 * 실패해도 throw하지 않음 (cleanup은 best-effort).
 */
async function deleteStorageImage(url) {
  if (!url || typeof url !== 'string') return;
  try {
    // https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodedPath}?...
    const match = url.match(/\/o\/([^?]+)/);
    if (!match) return;
    const path = decodeURIComponent(match[1]);
    await deleteObject(storageRef(storage, path));
  } catch (err) {
    logger.warn('Storage 이미지 삭제 실패:', err?.message || err);
  }
}

/**
 * usePersistentAssignment — 세션에 상시 활성화된 aiJudge 질문 ID 구독 + 쓰기.
 * session.persistentAssignmentId: currentQuestion과 독립적으로 학생 화면에
 * 항상 노출되는 라이브 과제. 강사가 "상시 과제 시작/종료"로 토글.
 */
export function usePersistentAssignment(sessionId) {
  const { value: assignmentId } = useRealtimeValue(sessionId ? `sessions/${sessionId}/persistentAssignmentId` : null);

  const setAssignment = useCallback(async (qId) => {
    if (!sessionId) return;
    await update(ref(db, `sessions/${sessionId}`), { persistentAssignmentId: qId || null });
  }, [sessionId]);

  const clearAssignment = useCallback(async () => {
    if (!sessionId) return;
    await update(ref(db, `sessions/${sessionId}`), { persistentAssignmentId: null });
  }, [sessionId]);

  return { assignmentId, setAssignment, clearAssignment };
}

/**
 * useLiveSubmissions — 세션 질문의 제출 목록 구독.
 * Path: sessions/{sid}/questions/{qid}/submissions
 */
export function useLiveSubmissions(sessionId, questionId) {
  const { value, loading, error } = useRealtimeValue(sessionId && questionId ? `sessions/${sessionId}/questions/${questionId}/submissions` : null);
  const submissions = useMemo(() => Object.entries(value || EMPTY_RECORD).map(([id, submission]) => ({ id, ...submission }))
    .sort((a, b) => (a.submittedAt || 0) - (b.submittedAt || 0)), [value]);

  return { submissions, loading, error };
}

/**
 * useMySubmission — 현재 학생의 제출물 하나.
 */
export function useMySubmission(sessionId, questionId, participantId) {
  const { value } = useRealtimeValue(sessionId && questionId && participantId ? `sessions/${sessionId}/questions/${questionId}/submissions/${participantId}` : null);
  const submission = value ? { id: participantId, ...value } : null;
  return submission;
}

/**
 * useSubmitLive — 학생 제출 액션.
 */
export function useSubmitLive(sessionId, questionId) {
  const submit = useCallback(async (participantId, { name, title, description, imageUrl, code }) => {
    if (!sessionId || !questionId || !participantId) throw new Error('세션 정보 누락');
    const prevSnap = await get(ref(db, `sessions/${sessionId}/questions/${questionId}/submissions/${participantId}`));
    const prevData = prevSnap.val();
    // 기존 이미지 URL이 다르면 이전 이미지는 Storage에서 삭제 (재제출 누수 방지)
    if (prevData?.imageUrl && prevData.imageUrl !== imageUrl) {
      await deleteStorageImage(prevData.imageUrl);
    }
    // database.rules.json validator 한계값으로 슬라이스 — 초과 시 rules가 제출 자체를 거부해
    // 학생에게 "실패" 에러만 뜨고 원인 불명확. 클라이언트에서 방어해 UX 보전.
    const submission = {
      name: (name || '익명').slice(0, 20),
      title: (title || '').slice(0, 200),
      description: (description || '').slice(0, 500),
      imageUrl: imageUrl ? String(imageUrl).slice(0, 2000) : null,
      code: (code || '').slice(0, 100000),
      // 최초 제출 시각 보존 — 재제출이 정렬 순서를 뒤섞지 않도록 (전자칠판 SubmissionGrid,
      // 심사 순서가 submittedAt 오름차순이므로 첫 제출 기준 유지가 공정)
      submittedAt: prevData?.submittedAt || serverTimestamp(),
    };
    await set(ref(db, `sessions/${sessionId}/questions/${questionId}/submissions/${participantId}`), submission);
  }, [sessionId, questionId]);

  const withdraw = useCallback(async (participantId) => {
    if (!sessionId || !questionId || !participantId) return;
    // 제출 취소 시 이미지도 Storage에서 정리
    const snap = await get(ref(db, `sessions/${sessionId}/questions/${questionId}/submissions/${participantId}`));
    const imageUrl = snap.val()?.imageUrl;
    if (imageUrl) await deleteStorageImage(imageUrl);
    await remove(ref(db, `sessions/${sessionId}/questions/${questionId}/submissions/${participantId}`));
  }, [sessionId, questionId]);

  return { submit, withdraw };
}

/**
 * useLiveJudgeResults — 심사 결과 + Top3 구독.
 */
export function useLiveJudgeResults(sessionId, questionId) {
  const base = sessionId && questionId ? `sessions/${sessionId}/questions/${questionId}` : null;
  const privileged = Boolean(getStaffSession());
  const pid = getParticipantId();
  const { value } = useRealtimeValue(base ? `${base}/aiResults${privileged ? '' : `/${pid}`}` : null);
  const results = privileged ? value || EMPTY_RECORD : value ? { [pid]: value } : EMPTY_RECORD;
  const { value: judgeState } = useRealtimeValue(base ? `${base}/aiJudgeState` : null);
  const revealed = judgeState?.revealedUpTo || 0;
  const { value: rawTop3 } = useRealtimeValue(privileged && base ? `${base}/aiTop3` : null);
  const { value: first } = useRealtimeValue(!privileged && base && revealed >= 1 ? `${base}/aiTop3/first` : null);
  const { value: second } = useRealtimeValue(!privileged && base && revealed >= 2 ? `${base}/aiTop3/second` : null);
  const { value: third } = useRealtimeValue(!privileged && base && revealed >= 3 ? `${base}/aiTop3/third` : null);
  const top3 = privileged ? rawTop3 : { first, second, third };
  const { value: judgeLog } = useRealtimeValue(base ? `${base}/aiJudgeLog` : null);

  return { results, top3, judgeState, judgeLog };
}

/**
 * useLiveJudging — 강사용 심사 오케스트레이터.
 * 세션 질문의 모든 제출을 순차 심사 → results + top3 저장.
 */
export function useLiveJudging(sessionId, questionId) {
  const [isJudging, setIsJudging] = useState(false);
  const [progress, setProgress] = useState(null); // { current, total, currentName }
  const abortRef = useRef(false);
  const judgingRef = useRef(false);
  const mountedRef = useRef(true);

  // Unmount 시 진행 중 심사 자동 중단 — 강사가 세션을 나가거나 로그아웃할 때
  // aiJudgeState가 'judging'으로 남아 좀비가 되는 것을 방지.
  // 이후 scheduleNext 순환에서 abortRef를 감지해 'aborted'로 최종 기록.
  useEffect(() => {
    mountedRef.current = true;
    return () => { abortRef.current = true; mountedRef.current = false; };
  }, []);

  const startJudging = useCallback(async () => {
    if (!sessionId || !questionId || judgingRef.current) return;
    judgingRef.current = true;
    abortRef.current = false;
    setIsJudging(true);
    const base = `sessions/${sessionId}/questions/${questionId}`;

    try {
      const snap = await get(ref(db, `${base}/submissions`));
      const data = snap.val() || {};
      const submissions = Object.entries(data).map(([id, v]) => ({ id, ...v }));

      if (submissions.length === 0) {
        await update(ref(db, base), { aiJudgeState: { status: 'idle' } });
        setIsJudging(false);
        judgingRef.current = false;
        return;
      }

      const qSnap = await get(ref(db, `${base}/title`));
      const questionTitle = qSnap.val() || '';

      await update(ref(db, base), {
        aiJudgeState: { status: 'judging', startedAt: serverTimestamp(), total: submissions.length },
        aiResults: null,
        aiTop3: null,
      });

      const allResults = [];
      // 배치 동시 심사 — 100명 규모에서 총 소요시간을 1/CONCURRENCY로 단축.
      // 값이 너무 크면 Gemini RPM 한계에 걸림 (유료 1000 RPM 기준 5~6 배치가 안전).
      //
      // 5명 동시 — 30명 약 42초 목표 (1건당 ~7초 × 30/5 ≈ 42초).
      // flash-lite Tier1 RPM ~4000으로 5 동시는 안전 마진 충분.
      // 일시 503은 withRetry 자동 처리.
      const CONCURRENCY = 5;
      let completed = 0;
      let running = 0;
      let index = 0;

      await new Promise((resolveAll) => {
        const scheduleNext = () => {
          if (abortRef.current) {
            if (running === 0) resolveAll();
            return;
          }
          while (running < CONCURRENCY && index < submissions.length) {
            const myIdx = index++;
            const sub = submissions[myIdx];
            running++;
            (async () => {
              const writeJudgeLog = (id, entry) => runTransaction(ref(db, `${base}/aiJudgeLog`), current =>
                current?.currentSubmissionId === sub.id ? { ...current, judges: { ...(current.judges || {}), [id]: entry } } : undefined, { applyLocally: false });
              try {
                // 권한/연결 오류도 작업 정리 경로를 거쳐 다음 제출을 진행한다.
                await update(ref(db, `${base}/aiJudgeState`), {
                  status: 'judging', current: completed + 1,
                  total: submissions.length, currentName: sub.name,
                });
                // 새 제출자 심사 시작 시 이전 판사 로그 초기화 (전자칠판 표시용)
                await set(ref(db, `${base}/aiJudgeLog`), {
                  currentSubmissionId: sub.id,
                  currentName: sub.name,
                  startedAt: serverTimestamp(),
                  judges: null,
                });
                const { results, summary } = await judgeLiveSubmission(
                  sub,
                  questionTitle,
                  // onJudgeComplete: 판사 완료 시 점수/하이라이트 방송
                  async (judgeId, result) => {
                    await writeJudgeLog(judgeId, {
                      name: result.judgeName,
                      state: result.error ? 'error' : 'done',
                      hint: result.highlight || result.comment?.slice(0, 40) || '평가 완료',
                      score: result.score ?? null,
                      at: Date.now(),
                    });
                  },
                  // onJudgeStart: 판사 thinking 방송
                  async (judge) => {
                    await writeJudgeLog(judge.id, {
                      name: judge.name,
                      state: 'thinking',
                      hint: pickThinking(judge.id),
                      at: Date.now(),
                    });
                  }
                );
                await set(ref(db, `${base}/aiResults/${sub.id}`), {
                  judges: results,
                  summary,
                  judgedAt: serverTimestamp(),
                });
                allResults.push({ submissionId: sub.id, name: sub.name, results, summary });
              } catch (err) {
                logger.error(`제출 ${sub.name} 심사 실패:`, err);
                // 실패한 제출은 allResults에서 제외 — calculateLiveTop3가 totalJudges===0 필터링
              } finally {
                completed++;
                running--;
                if (mountedRef.current) setProgress({ current: completed, total: submissions.length, currentName: sub.name });
                scheduleNext();
              }
            })();
          }
          if (running === 0 && index >= submissions.length) resolveAll();
        };
        scheduleNext();
      });

      if (!abortRef.current) {
        const top3 = calculateLiveTop3(allResults);
        // 원자적 multi-path update — 학생 클라이언트가 "done인데 top3 없음" 또는 "판사 로그 잔존"
        // 같은 찰나의 불일치 상태를 보지 않도록 한 번의 이벤트로 전달.
        // 학생 폰은 자기 점수만 보이고 TOP 공개는 강사가 버튼으로 단계적으로 올림 (revealedUpTo 0→1→2→3).
        await update(ref(db, base), {
          aiTop3: top3,
          'aiJudgeState/status': 'done',
          'aiJudgeState/completedAt': serverTimestamp(),
          'aiJudgeState/revealedUpTo': 0,
          aiJudgeLog: null,
        });
      } else {
        await update(ref(db, `${base}/aiJudgeState`), { status: 'aborted' });
      }
    } catch (err) {
      logger.error('라이브 심사 실행 실패:', err);
      await update(ref(db, `${base}/aiJudgeState`), { status: 'error', message: err.message || '알 수 없는 오류' });
    } finally {
      judgingRef.current = false;
      if (mountedRef.current) { setIsJudging(false); setProgress(null); }
    }
  }, [sessionId, questionId]);

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  const reset = useCallback(async () => {
    if (!sessionId || !questionId) return;
    const base = `sessions/${sessionId}/questions/${questionId}`;
    await update(ref(db, base), {
      aiJudgeState: null,
      aiResults: null,
      aiTop3: null,
      aiJudgeLog: null,
    });
  }, [sessionId, questionId]);

  const setRevealedUpTo = useCallback(async (n) => {
    if (!sessionId || !questionId) return;
    const clamped = Math.max(0, Math.min(3, n));
    await update(ref(db, `sessions/${sessionId}/questions/${questionId}/aiJudgeState`), {
      revealedUpTo: clamped,
    });
  }, [sessionId, questionId]);

  return { startJudging, isJudging, progress, abort, reset, setRevealedUpTo };
}
