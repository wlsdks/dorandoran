import { useMemo, useEffect, useRef } from 'react';
import { useRealtimeRecord } from '@/hooks/useRealtimeRecord';
import { useRealtimeValue } from '@/hooks/useRealtimeValue';
import { EMPTY_RECORD } from '@/lib/realtime';
import { getStaffSession, authenticatedRequest } from '@/lib/auth-session';
import { publicQuestions, publicQuestionUpdates } from '@/lib/public-questions';
import { db } from '@/lib/firebase';
import { ref, update } from 'firebase/database';

const SECONDARY_FIELDS = [
  'currentMode',
  'status',
  'pendingEvent',
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

/** 학생에게는 본인 투표만 표시한다. 네트워크 전송량은 기존 중첩 스키마의 한계가 남는다. */
export function useSession(sessionId, { participantId } = {}) {
  const privileged = Boolean(getStaffSession());
  const keys = privileged ? SESSION_FIELDS : SECONDARY_FIELDS_WITH_POINTER;
  const { value, loading, error } = useRealtimeRecord(sessionId ? `sessions/${sessionId}` : null, keys);
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
    if (!privileged || !sessionId || loading || !value) return;
    const view = publicQuestions(value.questions);
    const next = sessionId + JSON.stringify(view);
    if (signature.current === next) return;
    const changes = publicQuestionUpdates(previousView.current?.sessionId === sessionId ? previousView.current.value : null, view);
    signature.current = next;
    previousView.current = { sessionId, value: view };
    if (!Object.keys(changes).length) return;
    update(ref(db, `sessions/${sessionId}/publicQuestions`), changes).catch(() => { if (signature.current === next) signature.current = null; });
  }, [privileged, sessionId, loading, value]);
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
