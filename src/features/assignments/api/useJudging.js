import { useAIAvailability } from '@/hooks/useAIAvailability';
import { useState, useCallback, useRef, useEffect } from 'react';
import { ref, set, update, get, serverTimestamp, runTransaction } from 'firebase/database';
import { db } from '@/lib/firebase';
import { judgeSubmission } from '@/lib/judging/gemini';
import { calculateAwards } from '@/lib/judging/awards';
import { createWorkRun } from '@/lib/work-run';
import { throwIfAborted } from '@/lib/async-work';
import { logger } from '@/lib/logger';

/**
 * useJudging — 심사 오케스트레이션 훅.
 * 강사가 "심사 시작" 누르면 모든 제출물을 순차 심사.
 */
export function useJudging(assignmentId) {
  const { configured } = useAIAvailability();
  const [isJudging, setIsJudging] = useState(false);
  const [progress, setProgress] = useState(null); // { current, total, currentJudge, currentSubmission }
  const runRef = useRef(null);
  const mountedRef = useRef(false);
  const judgingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; runRef.current?.controller.abort(); };
  }, [assignmentId]);

  const startJudging = useCallback(async () => {
    if (!configured || !assignmentId || judgingRef.current) return false;
    judgingRef.current = true;
    const run = createWorkRun();
    runRef.current = run;
    setIsJudging(true);

    try {
      // 심사를 선택하지 않은 과제는 상태를 바꾸거나 AI를 호출하지 않는다.
      const assignSnap = await get(ref(db, `assignments/${assignmentId}`));
      throwIfAborted(run.signal);
      const assignment = assignSnap.val();
      if (!assignment || assignment.hasJudging === false) return false;
      const passThreshold = assignment.passThreshold ?? 3;
      await update(ref(db, `assignments/${assignmentId}`), { status: 'judging' });

      // Fetch all submissions
      const subsSnap = await get(ref(db, `assignments/${assignmentId}/submissions`));
      throwIfAborted(run.signal);
      const subsData = subsSnap.val() || {};
      const submissions = Object.entries(subsData).map(([id, v]) => ({ id, ...v }));

      if (submissions.length === 0) {
        await update(ref(db, `assignments/${assignmentId}`), { status: 'open' });
        if (mountedRef.current) setIsJudging(false);
        return;
      }

      const allResults = [];

      for (let i = 0; i < submissions.length; i++) {
        throwIfAborted(run.signal);

        const sub = submissions[i];
        setProgress({
          current: i + 1,
          total: submissions.length,
          currentSubmission: sub.name,
          currentJudge: null,
        });

        // Judge this submission
        const { results, summary } = await judgeSubmission(sub, (judgeId) => {
          if (mountedRef.current && !run.signal.aborted) setProgress(prev => prev ? { ...prev, currentJudge: judgeId } : prev);
        }, passThreshold, { signal: run.signal });
        throwIfAborted(run.signal);

        // Save results to Firebase
        await set(ref(db, `assignments/${assignmentId}/results/${sub.id}`), {
          judges: results,
          summary,
          judgedAt: serverTimestamp(),
        });

        allResults.push({
          submissionId: sub.id,
          name: sub.name,
          results,
          summary,
        });
      }

      if (!run.signal.aborted) {
        // Calculate and save awards
        const awards = calculateAwards(allResults);
        await set(ref(db, `assignments/${assignmentId}/awards`), awards);

        // Update status to judged
        throwIfAborted(run.signal);
        await update(ref(db, `assignments/${assignmentId}`), {
          status: 'judged',
          judgedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      if (!run.signal.aborted) logger.error('심사 실행 실패:', err);
      // 취소/실패 시 실행 중 상태만 되돌린다. 삭제된 과제를 다시 만들지 않는다.
      await runTransaction(ref(db, `assignments/${assignmentId}`), current => current?.status === 'judging'
        ? { ...current, status: 'open', judgeError: run.signal.aborted ? null : (err?.message || '심사 중 오류가 발생했습니다') }
        : undefined, { applyLocally: false }).catch(() => {});
    } finally {
      if (runRef.current === run) {
        runRef.current = null;
        judgingRef.current = false;
        if (mountedRef.current) { setIsJudging(false); setProgress(null); }
      }
      run.finish();
    }
  }, [assignmentId, configured]);

  const abort = useCallback(() => { runRef.current?.controller.abort(); }, []);

  return { startJudging, isJudging, progress, abort };
}
