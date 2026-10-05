import { useMemo, useSyncExternalStore } from 'react';
import { auth } from '@/lib/auth-session';
import { revealedQuestionEntries } from '@/lib/revealed-ranking';
import { createRevealedVotesStore } from '@/lib/revealed-votes-store';

/** Never subscribe to a question until both its public answer and reveal epoch exist. */
export function useRevealedQuestionVotes(sessionId, questions, { enabled = true } = {}) {
  const userId = auth.currentUser?.uid;
  const signature = JSON.stringify(enabled ? revealedQuestionEntries(questions).map(([id, question]) => [id, question.revealedAt, question.activatedAt || 0]) : []);
  const store = useMemo(() => createRevealedVotesStore(sessionId, JSON.parse(signature), userId), [sessionId, signature, userId]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
