import { useResourceList } from '@/hooks/useResourceList';
import { ref, get, remove, set, serverTimestamp } from 'firebase/database';
import { useCallback } from 'react';
import { db } from '@/lib/firebase';
import { generateSessionId, generateQuestionId } from '@/lib/utils';
import { logger } from '@/lib/logger';

/**
 * Fetches sessions from Firebase with metadata including course info.
 * Filters by ownership: master sees all, admin sees own, staff uses separate dashboard.
 *
 * @param {string} [adminUid] - Current admin's uid for ownership filtering
 * @param {string} [role] - 'master' | 'admin' | 'staff'
 * @returns {{ sessions: Array, loading: boolean, refresh: Function }}
 */
export function useSessionList(adminUid, _role) {
  const { items: sessions, loading, refresh: fetchSessions, error } = useResourceList('sessions');

  const deleteSession = useCallback(async (sessionId) => {
    try {
      await remove(ref(db, `sessions/${sessionId}`));
      fetchSessions();
      return true;
    } catch (err) {
      logger.error('Failed to delete session:', err);
      return false;
    }
  }, [fetchSessions]);

  /**
   * Duplicates a session: copies all questions (stripped of votes/runtime data),
   * same courseName, next roundNumber. Returns newSessionId or null on failure.
   */
  const duplicateSession = useCallback(async (sourceSessionId) => {
    try {
      // Find the source session metadata from our list
      const source = sessions.find((s) => s.id === sourceSessionId);
      if (!source) return null;

      // Determine next round number for this course
      let nextRound = (source.roundNumber || 0) + 1;
      if (source.courseName) {
        const sameCourseSessions = sessions.filter((s) => s.courseName === source.courseName);
        const maxRound = Math.max(0, ...sameCourseSessions.map((s) => s.roundNumber || 0));
        nextRound = maxRound + 1;
      }

      // Fetch source questions from Firebase
      const sourceSnap = await get(ref(db, `sessions/${sourceSessionId}/questions`));
      const sourceQuestions = sourceSnap.val();

      const newId = generateSessionId();
      const sessionData = {
        status: 'setting',
        currentQuestion: null,
        currentMode: 'waiting',
        createdAt: serverTimestamp(),
        courseName: source.courseName || null,
        courseId: source.courseId || null,
        creatorId: source.creatorId || adminUid || null,
        roundNumber: nextRound,
      };

      if (sourceQuestions) {
        const newQuestions = {};
        Object.values(sourceQuestions)
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .forEach((q, i) => {
            const newQId = generateQuestionId();
            const {
              votes: _v,
              aiGrades: _ag,
              activatedAt: _a,
              revealedAt: _r,
              awardedAt: _w,
              event: _e,
              ...rest
            } = q;
            newQuestions[newQId] = { ...rest, order: i + 1 };
          });
        sessionData.questions = newQuestions;
      }

      await set(ref(db, `sessions/${newId}`), sessionData);

      fetchSessions();

      return newId;
    } catch (err) {
      logger.error('Failed to duplicate session:', err);
      return null;
    }
  }, [sessions, adminUid, fetchSessions]);

  return { sessions, loading, error, refresh: fetchSessions, deleteSession, duplicateSession };
}
