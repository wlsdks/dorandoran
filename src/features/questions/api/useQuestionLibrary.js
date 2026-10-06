import { useState, useEffect, useCallback, useMemo } from 'react';
import { ref, get, set, remove, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import { generateQuestionId } from '@/lib/utils';
import { QUESTION_TYPE_FIELDS } from '@/lib/question';

/**
 * Hook for managing the admin's personal question library.
 * Firebase path: questionLibrary/{adminUid}/{questionId}
 *
 * @param {string|null} adminUid - The admin user's UID
 * @returns {{ questions: Array, loading: boolean, saveQuestion: Function, deleteQuestion: Function, updateQuestion: Function }}
 */
export function useQuestionLibrary(adminUid) {
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!adminUid) {
      setRaw(null);
      setLoading(false);
      return;
    }

    const libRef = ref(db, `questionLibrary/${adminUid}`);
    const unsubscribe = onValue(
      libRef,
      (snapshot) => {
        setRaw(snapshot.val());
        setLoading(false);
      },
      () => {
        setRaw(null);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [adminUid]);

  const questions = useMemo(() => {
    if (!raw) return [];
    return Object.entries(raw)
      .map(([id, q]) => ({ id, ...q }))
      .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  }, [raw]);

  const saveQuestion = useCallback(async (questionData) => {
    if (!adminUid) return null;
    try {
      const qId = generateQuestionId();
      const data = {
        ...questionData,
        savedAt: Date.now(),
      };
      // Strip runtime fields that shouldn't be saved
      delete data.votes;
      delete data.activatedAt;
      delete data.revealedAt;
      delete data.awardedAt;
      delete data.event;

      await set(ref(db, `questionLibrary/${adminUid}/${qId}`), data);
      return qId;
    } catch {
      return null;
    }
  }, [adminUid]);

  const deleteQuestion = useCallback(async (qId) => {
    if (!adminUid) return false;
    try {
      await remove(ref(db, `questionLibrary/${adminUid}/${qId}`));
      return true;
    } catch {
      return false;
    }
  }, [adminUid]);

  const updateQuestion = useCallback(async (qId, updates) => {
    if (!adminUid) return false;
    try {
      const snap = await get(ref(db, `questionLibrary/${adminUid}/${qId}`));
      const existing = snap.val();
      if (!existing) return false;
      // 유형별 필드는 새 값으로 통째로 바꾼다 — 유형을 바꾸거나 이미지를 지웠을 때 예전 값이 남지 않게.
      const base = { ...existing };
      QUESTION_TYPE_FIELDS.forEach((key) => delete base[key]);
      delete base.id;
      await set(ref(db, `questionLibrary/${adminUid}/${qId}`), {
        ...base,
        ...updates,
        savedAt: existing.savedAt,
        updatedAt: Date.now(),
      });
      return true;
    } catch {
      return false;
    }
  }, [adminUid]);

  return { questions, loading, saveQuestion, deleteQuestion, updateQuestion };
}
