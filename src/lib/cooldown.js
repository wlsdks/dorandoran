/** 대기 중에도 동기적으로 잠근다. 종료된 화면의 늦은 응답은 타이머를 다시 만들지 못한다. */
export function createCooldown(milliseconds, scope) {
  let active = true;
  let busy = false;
  let generation = 0;
  let timer = null;
  const listeners = new Set();
  const notify = () => listeners.forEach((listener) => listener());
  const valid = (attempt) => active && attempt === generation;
  return {
    scope,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => !busy,
    activate() { active = true; },
    begin() { if (!active || busy) return null; busy = true; notify(); return ++generation; },
    finish(attempt) {
      if (!valid(attempt)) return false;
      timer = setTimeout(() => { timer = null; busy = false; notify(); }, milliseconds);
      return true;
    },
    fail(attempt) { if (valid(attempt)) { busy = false; notify(); } },
    dispose() { active = false; generation++; if (timer !== null) clearTimeout(timer); timer = null; busy = false; },
  };
}
