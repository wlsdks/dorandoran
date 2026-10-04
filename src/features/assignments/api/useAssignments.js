import { useResourceList } from '@/hooks/useResourceList';
import { useRealtimeRecord } from '@/hooks/useRealtimeRecord';
import { auth } from '@/lib/auth-session';
import { useCallback } from 'react';
import { ref, push, set, update, remove, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';

const ASSIGNMENT_FIELDS = ['title', 'description', 'courseName', 'roundNumber', 'hasJudging', 'passThreshold', 'status', 'createdAt', 'closedAt', 'judgedAt'];

export const ASSIGNMENT_STATUS = {
  open: '제출 중',
  closed: '마감',
  judging: '심사 중',
  judged: '심사 완료',
};

/**
 * useAssignmentList — 과제 목록 구독.
 * courseName이 없으면 전체 목록, 있으면 해당 코스만 필터.
 */
export function useAssignmentList(courseName) {
  const { items: assignments, loading, error } = useResourceList('assignments', { courseName });
  return { assignments, loading, error };
}

/**
 * useAssignment — 단일 과제 구독.
 */
export function useAssignment(assignmentId) {
  const { value, loading, error } = useRealtimeRecord(assignmentId ? `assignments/${assignmentId}` : null, ASSIGNMENT_FIELDS);
  const assignment = value?.title ? { id: assignmentId, ...value } : null;
  return { assignment, loading, error };
}

/**
 * useAssignmentActions — 과제 CRUD 액션.
 */
export function useAssignmentActions() {
  const createAssignment = useCallback(async (courseName, { title, description, roundNumber, hasJudging = true, passThreshold = 3 }) => {
    const assignmentsRef = ref(db, 'assignments');
    const newRef = push(assignmentsRef);
    await set(newRef, {
      title,
      ownerId: auth.currentUser.uid,
      description: description || '',
      courseName,
      roundNumber: roundNumber || null,
      hasJudging,
      passThreshold,
      status: 'open',
      createdAt: serverTimestamp(),
      closedAt: null,
      judgedAt: null,
    });
    return newRef.key;
  }, []);

  const updateAssignment = useCallback(async (assignmentId, data) => {
    await update(ref(db, `assignments/${assignmentId}`), data);
  }, []);

  const deleteAssignment = useCallback(async (assignmentId) => {
    await remove(ref(db, `assignments/${assignmentId}`));
  }, []);

  const closeAssignment = useCallback(async (assignmentId) => {
    await update(ref(db, `assignments/${assignmentId}`), {
      status: 'closed',
      closedAt: serverTimestamp(),
    });
  }, []);

  return { createAssignment, updateAssignment, deleteAssignment, closeAssignment };
}
