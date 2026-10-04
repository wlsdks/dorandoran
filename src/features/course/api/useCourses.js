import { useResourceList } from '@/hooks/useResourceList';
import { useCallback } from 'react';
import { ref, get, set, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { uuid } from '@/lib/utils';

function generateCourseId() {
  return 'crs_' + uuid().slice(0, 8);
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

  const deleteCourse = useCallback(async (courseId) => {
    const staffSnap = await get(ref(db, `courses/${courseId}/staff`));
    const updates = { [`courses/${courseId}`]: null };
    for (const uid of Object.keys(staffSnap.val() || {})) updates[`staffCourses/${uid}/${courseId}`] = null;
    await update(ref(db), updates);
    await fetchCourses();
  }, [fetchCourses]);

  return { courses, loading, error, createCourse, deleteCourse, refresh: fetchCourses };
}
