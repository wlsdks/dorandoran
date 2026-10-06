import { useState, useEffect, useCallback, useRef } from 'react';
import { ref, update, onValue } from 'firebase/database';
import { authenticatedRequest } from '@/lib/auth-session';
import { db } from '@/lib/firebase';

/**
 * Hook for managing staff assignment to a course.
 * - staffList: real-time list of assigned staff
 * - searchStaff(query): search registered staff users
 * - assignStaff / removeStaff: multi-path atomic updates
 *
 * @param {string} courseId
 * @returns {{ staffList, loading, searchStaff, searchResults, searchLoading, assignStaff, removeStaff }}
 */
export function useStaffAssignment(courseId) {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Real-time listener for assigned staff
  useEffect(() => {
    if (!courseId) { setStaffList([]); setLoading(false); return; }
    setLoading(true);
    const unsub = onValue(ref(db, `courses/${courseId}/staff`), (snap) => {
      const val = snap.val() || {};
      const list = Object.entries(val).map(([uid, data]) => ({
        uid,
        displayName: data.displayName,
        assignedAt: data.assignedAt,
      }));
      list.sort((a, b) => (b.assignedAt || 0) - (a.assignedAt || 0));
      setStaffList(list);
      setLoading(false);
    });
    return () => unsub();
  }, [courseId]);

  // 스태프 검색은 서버 API로 한다 — 계정 정보(admins/staffProfiles)는 클라이언트가 읽을 수 없다.
  // 입력마다 요청하지 않도록 250ms 뒤 마지막 검색어만 보낸다.
  const [searchError, setSearchError] = useState(null);
  const searchSeq = useRef(0);
  const searchTimer = useRef(null);
  useEffect(() => () => clearTimeout(searchTimer.current), []);
  const searchStaff = useCallback((query) => {
    const q = (query || '').trim();
    clearTimeout(searchTimer.current);
    const seq = ++searchSeq.current;
    setSearchError(null);
    if (!q) { setSearchResults([]); setSearchLoading(false); return; }
    setSearchLoading(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const { results = [] } = await authenticatedRequest('/api/staff/search', { query: q });
        if (seq !== searchSeq.current) return;
        const assignedUids = new Set(staffList.map((s) => s.uid));
        setSearchResults(results.filter((r) => !assignedUids.has(r.uid)));
      } catch (err) {
        if (seq !== searchSeq.current) return;
        setSearchResults([]);
        setSearchError(err.status === 429 ? '잠시 후 다시 검색해주세요.' : err.message || '스태프를 검색하지 못했어요.');
      } finally {
        if (seq === searchSeq.current) setSearchLoading(false);
      }
    }, 250);
  }, [staffList]);

  // Assign staff: atomic multi-path update
  const assignStaff = useCallback(async (staffUid, staffDisplayName) => {
    if (!courseId || !staffUid) return;
    const updates = {};
    updates[`courses/${courseId}/staff/${staffUid}`] = {
      displayName: staffDisplayName,
      assignedAt: Date.now(),
    };
    updates[`staffCourses/${staffUid}/${courseId}`] = true;
    await update(ref(db), updates);
  }, [courseId]);

  // Remove staff: atomic multi-path removal
  const removeStaff = useCallback(async (staffUid) => {
    if (!courseId || !staffUid) return;
    const updates = {};
    updates[`courses/${courseId}/staff/${staffUid}`] = null;
    updates[`staffCourses/${staffUid}/${courseId}`] = null;
    await update(ref(db), updates);
  }, [courseId]);

  return { staffList, loading, searchStaff, searchResults, searchLoading, searchError, assignStaff, removeStaff };
}
