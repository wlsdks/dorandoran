import { useRealtimeValue } from '@/hooks/useRealtimeValue';
import { EMPTY_RECORD } from '@/lib/realtime';


/**
 * useAwards — 과제의 시상 결과 구독.
 */
export function useAwards(assignmentId) {
  const { value: awards, loading, error } = useRealtimeValue(assignmentId ? `assignments/${assignmentId}/awards` : null);

  return { awards, loading, error };
}

/**
 * useAllResults — 과제의 전체 심사 결과 구독.
 */
export function useAllResults(assignmentId) {
  const { value, loading, error } = useRealtimeValue(assignmentId ? `assignments/${assignmentId}/results` : null);
  const results = value || EMPTY_RECORD;

  return { results, loading, error };
}
