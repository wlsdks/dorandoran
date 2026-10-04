import { useCallback, useLayoutEffect, useRef } from 'react';

/** Firebase의 낙관적 로컬 snapshot은 저장 확인이 아니다. 송신 결과와 초기 답변 복원을 분리한다. */
export function useVoteAcknowledgement(sourceKey) {
  const operation = useRef({ sourceKey, active: true, attempted: false, pending: false, generation: 0 });
  useLayoutEffect(() => {
    if (operation.current.sourceKey !== sourceKey) {
      operation.current = { sourceKey, active: true, attempted: false, pending: false, generation: 0 };
    }
    const current = operation.current;
    current.active = true;
    return () => { current.active = false; };
  }, [sourceKey]);
  const canRestore = useCallback(() => {
    const current = operation.current;
    return current.sourceKey === sourceKey && current.active && !current.attempted;
  }, [sourceKey]);
  const begin = useCallback(() => {
    const current = operation.current;
    if (current.sourceKey !== sourceKey || !current.active || current.pending) return null;
    current.attempted = true;
    current.pending = true;
    return { current, generation: ++current.generation };
  }, [sourceKey]);
  const isCurrent = useCallback((token) => {
    const current = operation.current;
    return Boolean(token && token.current === current && current.active && token.generation === current.generation);
  }, []);
  const finish = useCallback((token) => {
    const current = operation.current;
    if (!isCurrent(token) || !current.pending) return false;
    current.pending = false;
    return true;
  }, [isCurrent]);
  const reset = useCallback(() => {
    const current = operation.current;
    if (current.sourceKey !== sourceKey || !current.active || current.pending) return false;
    current.attempted = false;
    current.generation += 1;
    return true;
  }, [sourceKey]);
  return { begin, finish, canRestore, isCurrent, reset };
}
