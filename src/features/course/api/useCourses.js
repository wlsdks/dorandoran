import { useResourceList, notifyResourceChange } from '@/hooks/useResourceList';
import { authenticatedRequest } from '@/lib/auth-session';
import { useCallback } from 'react';
import { ref, get, set, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { uuid } from '@/lib/utils';

function generateCourseId() {
  return 'crs_' + uuid().slice(0, 8);
}

/** 강의와 스태프 역색인을 함께 지운다. */
export async function deleteCourseRecord(courseId) {
  const staffSnap = await get(ref(db, `courses/${courseId}/staff`));
  const updates = { [`courses/${courseId}`]: null };
  for (const uid of Object.keys(staffSnap.val() || {})) updates[`staffCourses/${uid}/${courseId}`] = null;
  await update(ref(db), updates);
  notifyResourceChange('courses');
  notifyResourceChange('sessions');
}

/** 강의 이름 바꾸기 — 목록은 차수(세션)·과제에 복사된 강의명으로 묶이므로 함께 바꾼다. */
export async function renameCourseRecords(courseId, name, { oldName, sessionIds = [] } = {}) {
  const trimmed = (name || '').trim();
  if (!trimmed || trimmed.length > 100) throw new Error('강의 이름을 확인해주세요.');
  const updates = { [`courses/${courseId}/name`]: trimmed };
  for (const sid of sessionIds) updates[`sessions/${sid}/courseName`] = trimmed;
  if (oldName) {
    const { items = [] } = await authenticatedRequest('/api/staff/resources', { resource: 'assignments', courseName: oldName }).catch(() => ({}));
    for (const item of items) if (item?.id) updates[`assignments/${item.id}/courseName`] = trimmed;
  }
  await update(ref(db), updates);
  notifyResourceChange('courses');
  notifyResourceChange('sessions');
  notifyResourceChange('assignments');
}

/**
 * Hook for managing courses with role-based filtering.
 * - master: sees all courses
 * - admin (instructor): sees own courses (ownerId === adminUid)
 * - staff: sees assigned courses via staffCourses/{uid} reverse index
 *
 * @param {string} adminUid
 * @param {string} role - 'master' | 'admin' | 'staff'
 * @returns {{ courses, loading, createCourse, deleteCourse, refresh }}
 */
export function useCourses(adminUid, _role) {
  const { items: courses, loading, refresh: fetchCourses, error } = useResourceList('courses');

  const createCourse = useCallback(async (name, ownerName) => {
    const id = generateCourseId();
    await set(ref(db, `courses/${id}`), {
      name,
      ownerId: adminUid,
      ownerName: ownerName || '',
      createdAt: Date.now(),
    });
    await fetchCourses();
    return id;
  }, [adminUid, fetchCourses]);

  const deleteCourse = useCallback(async (courseId) => { await deleteCourseRecord(courseId); await fetchCourses(); }, [fetchCourses]);
  const renameCourse = useCallback(async (courseId, name, options) => { await renameCourseRecords(courseId, name, options); await fetchCourses(); }, [fetchCourses]);

  return { courses, loading, error, createCourse, deleteCourse, renameCourse, refresh: fetchCourses };
}
