import { useMemo, useCallback } from 'react';
import { ref, update, remove } from 'firebase/database';
import { db } from '@/lib/firebase';
import { authenticatedRequest } from '@/lib/auth-session';
import { EMPTY_RECORD } from '@/lib/realtime';
import { useRealtimeValue } from '@/hooks/useRealtimeValue';
import { useCooldown } from '@/hooks/useCooldown';

export function useClassQuestions(sessionId) {
  const { value, loading, error } = useRealtimeValue(sessionId ? `sessions/${sessionId}/classQuestions` : null, { limit: 100, throttleMs: 50 });
  const raw = value || EMPTY_RECORD;
  const post = useCooldown(`${sessionId}:question`, 3000);
  const answer = useCooldown(`${sessionId}:answer`, 3000);
  const { begin: beginPost, finish: finishPost, fail: failPost } = post;
  const { begin: beginAnswer, finish: finishAnswer, fail: failAnswer } = answer;
  const questions = useMemo(() => Object.entries(raw).map(([id, data]) => ({ id, ...data,
    upvoteCount: Object.keys(data.upvotes || EMPTY_RECORD).length,
    answerList: Object.entries(data.answers || EMPTY_RECORD).map(([id, value]) => ({ id, ...value, upvoteCount: Object.keys(value.upvotes || EMPTY_RECORD).length }))
      .sort((a, b) => b.upvoteCount - a.upvoteCount || (a.timestamp || 0) - (b.timestamp || 0)),
    answerCount: Object.keys(data.answers || EMPTY_RECORD).length,
  })).sort((a, b) => Number(Boolean(a.answered)) - Number(Boolean(b.answered)) || b.upvoteCount - a.upvoteCount || (b.timestamp || 0) - (a.timestamp || 0)), [raw]);
  const postQuestion = useCallback(async (text) => {
    if (!sessionId || !text?.trim()) return false;
    const ticket = beginPost(); if (ticket === null) return false;
    try { await authenticatedRequest('/api/classroom/question', { sessionId, text: text.trim() }); return finishPost(ticket); }
    catch { failPost(ticket); return false; }
  }, [sessionId, beginPost, finishPost, failPost]);
  const postAnswer = useCallback(async (questionId, text) => {
    if (!sessionId || !questionId || !text?.trim()) return false;
    const ticket = beginAnswer(); if (ticket === null) return false;
    try { await authenticatedRequest('/api/classroom/answer', { sessionId, questionId, text: text.trim() }); return finishAnswer(ticket); }
    catch { failAnswer(ticket); return false; }
  }, [sessionId, beginAnswer, finishAnswer, failAnswer]);
  const toggleUpvote = useCallback(async (questionId, participantId) => {
    if (!sessionId || !questionId || !participantId) return;
    const path = `sessions/${sessionId}/classQuestions/${questionId}/upvotes/${participantId}`;
    if (raw[questionId]?.upvotes?.[participantId]) await remove(ref(db, path));
    else await update(ref(db, `sessions/${sessionId}/classQuestions/${questionId}/upvotes`), { [participantId]: true });
  }, [sessionId, raw]);
  const toggleAnswerUpvote = useCallback(async (questionId, answerId, participantId) => {
    if (!sessionId || !questionId || !answerId || !participantId) return;
    const path = `sessions/${sessionId}/classQuestions/${questionId}/answers/${answerId}/upvotes/${participantId}`;
    if (raw[questionId]?.answers?.[answerId]?.upvotes?.[participantId]) await remove(ref(db, path));
    else await update(ref(db, `sessions/${sessionId}/classQuestions/${questionId}/answers/${answerId}/upvotes`), { [participantId]: true });
  }, [sessionId, raw]);
  const markAnswered = useCallback(async (id, answeredBy, answeredByRole) => {
    if (!sessionId || !id) return;
    await update(ref(db, `sessions/${sessionId}/classQuestions/${id}`), { answered: true,
      ...(answeredBy ? { answeredBy } : {}), ...(answeredByRole ? { answeredByRole } : {}) });
  }, [sessionId]);
  const dismissQuestion = useCallback(async (id) => { if (sessionId && id) await remove(ref(db, `sessions/${sessionId}/classQuestions/${id}`)); }, [sessionId]);
  const toggleHidden = useCallback(async (id) => {
    if (sessionId && id) await update(ref(db, `sessions/${sessionId}/classQuestions/${id}`), { hidden: !raw[id]?.hidden });
  }, [sessionId, raw]);
  return { questions, unansweredCount: questions.filter((question) => !question.answered).length, postQuestion, postAnswer,
    toggleUpvote, toggleAnswerUpvote, markAnswered, dismissQuestion, toggleHidden, loading, error, canPost: post.canSend, canAnswer: answer.canSend };
}
