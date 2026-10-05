import { useEffect, useMemo, useRef } from 'react';
import { ref, set } from 'firebase/database';
import { useVotes } from '@/hooks/useVotes';
import { db } from '@/lib/firebase';
import { auth } from '@/lib/auth-session';
import { logger } from '@/lib/logger';
import { EMPTY_LIST } from '@/lib/realtime';
import { quizDistribution } from '@/lib/quiz-distribution';

/** The instructor publishes a small tally at most five times per second. */
export function useQuizDistributionPublisher(sessionId, session, enabled) {
  const questionId = session?.currentQuestion;
  const question = session?.questions?.[questionId];
  const active = enabled && question?.type === 'quiz' && ['poll', 'quiz'].includes(session?.currentMode);
  const { countByValue, loading, error } = useVotes(active ? sessionId : null, active ? questionId : null);
  const options = question?.options || EMPTY_LIST;
  const round = question?.activatedAt || 0;
  const payload = useMemo(() => active && !loading && !error && options.length
    ? JSON.stringify(quizDistribution(options, countByValue, round)) : null, [active, loading, error, options, countByValue, round]);
  const scope = active ? `${auth.currentUser?.uid}:${sessionId}:${questionId}:${round}` : null;
  const state = useRef({ scope: null, latest: null, sent: null, timer: null });

  useEffect(() => {
    const current = state.current;
    current.scope = scope;
    current.latest = null;
    current.sent = null;
    return () => {
      clearTimeout(current.timer);
      current.timer = null;
      current.scope = null;
      current.latest = null;
    };
  }, [scope]);

  useEffect(() => {
    const current = state.current;
    current.latest = payload;
    if (!scope || !payload || current.sent === payload || current.timer) return;
    // Trailing throttle, not debounce: a continuous stream still updates the audience.
    current.timer = setTimeout(() => {
      current.timer = null;
      if (current.scope !== scope || !current.latest || current.latest === current.sent) return;
      const next = current.latest;
      current.sent = next;
      set(ref(db, `sessions/${sessionId}/publicQuizAggregates/${questionId}`), JSON.parse(next)).catch(error => {
        if (current.scope !== scope) return;
        current.sent = null;
        logger.error('Quiz distribution publish failed:', error);
      });
    }, 200);
  }, [scope, payload, sessionId, questionId]);
}
