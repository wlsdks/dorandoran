import { useMemo, useEffect, useRef } from 'react';
import { useRealtimeRecord } from '@/hooks/useRealtimeRecord';
import { useRealtimeValue } from '@/hooks/useRealtimeValue';
import { EMPTY_RECORD } from '@/lib/realtime';
import { getStaffSession, authenticatedRequest } from '@/lib/auth-session';
import { publicQuestions, publicQuestionUpdates, groupUpdatesByQuestion } from '@/lib/public-questions';
import { logger } from '@/lib/logger';
import { db } from '@/lib/firebase';
import { ref, update } from 'firebase/database';

const SECONDARY_FIELDS = [
  'currentMode',
  'status',
  'pendingEvent',
  'leaderboardPage',
  'leaderboardHighlight',
  'courseName',
  'courseId',
  'creatorId',
  'roundNumber',
  'createdAt',
  'startedAt',
  'reviewingUntil',
  'drumroll',
  'gameState',
  'persistentAssignmentId',
  'activeAssignmentId',
  'requireEmployeeId',
  'drawOnly',
];
const SECONDARY_FIELDS_WITH_POINTER = ['currentQuestion', ...SECONDARY_FIELDS];
const SESSION_FIELDS = ['questions', ...SECONDARY_FIELDS_WITH_POINTER];
// 강사 화면의 questions 칸에는 모든 학생 투표가 들어 있다. 300명이 몰려 답할 때 투표마다 화면 전체를
// 다시 그리지 않도록 120ms로 묶는다(첫 값은 즉시). 메타 칸(currentQuestion 등)은 묶지 않는다.
const SESSION_THROTTLE = Object.freeze({ questions: 120 });

/** 학생에게는 본인 투표만 표시한다. 네트워크 전송량은 기존 중첩 스키마의 한계가 남는다. */
export function useSession(sessionId, { participantId, readOnly = false } = {}) {
  const staffProfile = getStaffSession();
  const privileged = Boolean(staffProfile);
  const keys = privileged ? SESSION_FIELDS : SECONDARY_FIELDS_WITH_POINTER;
  const { value, loading, error } = useRealtimeRecord(sessionId ? `sessions/${sessionId}` : null, keys, undefined, privileged ? SESSION_THROTTLE : undefined);
  const canPublish = !readOnly && (staffProfile?.role === 'master' || (staffProfile?.role === 'admin' && staffProfile.uid === value?.creatorId));
  const { value: visible, loading: viewLoading, error: viewError } = useRealtimeValue(!privileged && sessionId ? `sessions/${sessionId}/publicQuestions` : null);
  const questionSignature = Object.keys(visible || EMPTY_RECORD).sort().join(',');
  const questionIds = useMemo(() => questionSignature ? questionSignature.split(',') : [], [questionSignature]);
  const voteKeys = useMemo(() => questionIds.map(id => `${id}/votes/${participantId}`), [questionIds, participantId]);
  const { value: ownVotes, loading: ownLoading, error: ownError } = useRealtimeRecord(!privileged && participantId && sessionId && voteKeys.length ? `sessions/${sessionId}/questions` : null, voteKeys);
  const questions = useMemo(() => privileged ? value?.questions || EMPTY_RECORD : Object.fromEntries(Object.entries(visible || EMPTY_RECORD).map(([id, question]) => {
    const mine = ownVotes?.[`${id}/votes/${participantId}`];
    return [id, mine ? { ...question, votes: { [participantId]: mine } } : question];
  })), [privileged, value?.questions, visible, ownVotes, participantId]);
  const signature = useRef(null);
  const previousView = useRef(null);
  useEffect(() => {
    if (!canPublish || !sessionId || loading || !value) return;
    const view = publicQuestions(value.questions);
    const next = sessionId + JSON.stringify(view);
    if (signature.current === next) return;
    const changes = publicQuestionUpdates(previousView.current?.sessionId === sessionId ? previousView.current.value : null, view);
    signature.current = next;
    previousView.current = { sessionId, value: view };
    if (!Object.keys(changes).length) return;
    // 문항별로 나눠 보낸다 — 한 문항이 규칙에 막혀도 나머지는 학생에게 전달된다.
    // 실패한 문항은 기록하고, 다음 변경 때 다시 비교되도록 이전 공개본에서 뺀다(조용한 무한 재시도 없음).
    const groups = groupUpdatesByQuestion(changes);
    Promise.allSettled(Object.entries(groups).map(([id, patch]) =>
      update(ref(db, `sessions/${sessionId}/publicQuestions`), patch).catch((err) => { throw Object.assign(err || new Error('sync failed'), { questionId: id }); })))
      .then(results => {
        const failed = results.filter(r => r.status === 'rejected').map(r => r.reason?.questionId).filter(Boolean);
        if (!failed.length) return;
        logger.error('공개 문항 동기화 실패:', failed.join(', '));
        if (previousView.current?.sessionId !== sessionId) return;
        const rest = { ...previousView.current.value };
        failed.forEach(id => { delete rest[id]; });
        previousView.current = { sessionId, value: rest };
      });
  }, [canPublish, sessionId, loading, value]);
  useEffect(() => {
    if (!privileged && sessionId && !viewLoading && !visible) {
      authenticatedRequest('/api/classroom/manifest', { sessionId }).catch(() => {});
    }
  }, [privileged, sessionId, viewLoading, visible]);
  const pending = loading || (!privileged && (viewLoading || ownLoading));
  const session = useMemo(() => value && value.createdAt && !pending && !error && !viewError && !ownError ? { ...value, questions } : null,
    [value, pending, error, viewError, ownError, questions]);
  return { session, loading: pending, error: error || viewError || ownError };
}

/** 헤더에 필요한 시작 시각과 상태만 구독한다. */
export function useSessionMeta(sessionId) {
  const { value: startedAt } = useRealtimeValue(sessionId ? `sessions/${sessionId}/startedAt` : null);
  const { value: status } = useRealtimeValue(sessionId ? `sessions/${sessionId}/status` : null);
  return { startedAt, status };
}
