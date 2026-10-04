import { useRealtimeValue } from '@/hooks/useRealtimeValue';
import { useCallback } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '@/lib/firebase';

/**
 * 추첨 화면을 강사 화면 ↔ 전자칠판 사이에 동기화한다.
 *
 * 전자칠판은 조작하는 곳이 아니라 **비추는 곳**이다. 두 화면이 각자 추첨을 돌리면 관객이 보는
 * 결과와 강사가 부르는 결과가 서로 달라진다. 그래서 조작은 강사 화면(control)만 하고,
 * 진행 상태를 세션에 실어 전자칠판(view)이 그대로 따라 그린다.
 *
 * 저장 위치는 세션의 gameState — 질문을 넘기면 useQuestionActions가 함께 비우므로
 * 이전 판의 잔재가 다음 화면에 남지 않는다. 게임마다 mode로 구분해 한 노드를 나눠 쓴다.
 *
 * @param {string} sessionId
 * @param {{ role: 'control' | 'view', mode: string }} opts
 * @returns {{ remote: object|null, publish: (state: object) => void }}
 */
export function useGameMirror(sessionId, { role, mode }) {
  const { value } = useRealtimeValue(sessionId && role === 'view' ? `sessions/${sessionId}/gameState` : null, { scope: mode });
  const remote = value?.mode === mode ? value : null;

  const publish = useCallback((state) => {
    if (role !== 'control') return Promise.resolve(false);
    if (!sessionId) return Promise.resolve(true);
    const preparing = state.phase === 'idle' || state.phase === 'rolling' || state.picking === true
      || ('selected' in state && !state.selected) || ('won' in state && !state.won);
    return update(ref(db, `sessions/${sessionId}`), {
      gameState: { mode, ...state },
      ...(preparing ? { gameResult: null } : {}),
    }).then(() => true).catch(() => false);
  }, [sessionId, role, mode]);

  return { remote, publish };
}
