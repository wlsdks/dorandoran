/** QA 모드에서만 실제 SDK 구독을 계측한다. 운영 빌드에는 포함되지 않는다. */
export function realtimeDiagnostics() {
  const id = '\0realtime-diagnostics';
  return {
    name: 'realtime-diagnostics',
    resolveId(source) { if (source === 'virtual:realtime-diagnostics') return id; },
    load(source) {
      if (source !== id) return;
      return `export * from 'firebase/database';
import { onValue as realValue, onChildAdded as realAdded } from 'firebase/database';
const state = globalThis.__realtimeDiagnostics ||= { active: 0, starts: 0, stops: 0, paths: {} };
function track(method, reference, args) {
  const path = reference.toString(); state.active++; state.starts++; state.paths[path] = (state.paths[path] || 0) + 1;
  const unsubscribe = method(reference, ...args); let active = true;
  return () => { if (!active) return; active = false; unsubscribe(); state.active--; state.stops++; if (--state.paths[path] === 0) delete state.paths[path]; };
}
export const onValue = (reference, ...args) => track(realValue, reference, args);
export const onChildAdded = (reference, ...args) => track(realAdded, reference, args);`;
    },
    transform(code, source) {
      if (!source.includes('/src/') || source.includes('/node_modules/')) return;
      if (!code.includes('firebase/database')) return;
      return { code: code.replace(/from (['"])firebase\/database\1/g, "from 'virtual:realtime-diagnostics'"), map: null };
    },
  };
}
