/** 취소 후 이미 시작한 DB 쓰기까지 끝나기를 기다린 뒤 초기화할 수 있다. */
export function createWorkRun() {
  const controller = new AbortController();
  let complete;
  const done = new Promise(resolve => { complete = resolve; });
  return { controller, signal: controller.signal, done, finish: () => complete() };
}
