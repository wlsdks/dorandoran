export function abortReason(signal) {
  return signal?.reason instanceof Error ? signal.reason : new DOMException('작업이 취소되었습니다.', 'AbortError');
}

export function throwIfAborted(signal) {
  if (signal?.aborted) throw abortReason(signal);
}

/** 작업이 끝나면 deadline과 abort listener를 모두 해제한다. 취소 신호는 실제 전송까지 전달한다. */
export async function withDeadline(work, timeoutMs, { signal, message = '요청 타임아웃' } = {}) {
  throwIfAborted(signal);
  const controller = new AbortController();
  const propagate = () => controller.abort(abortReason(signal));
  let rejectStopped;
  const stopped = new Promise((_, reject) => { rejectStopped = reject; });
  const onAbort = () => rejectStopped(abortReason(controller.signal));
  controller.signal.addEventListener('abort', onAbort, { once: true });
  signal?.addEventListener('abort', propagate, { once: true });
  const timer = setTimeout(() => controller.abort(new Error(message)), timeoutMs);
  try {
    throwIfAborted(signal);
    return await Promise.race([Promise.resolve().then(() => { throwIfAborted(controller.signal); return work(controller.signal); }), stopped]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', propagate);
    controller.signal.removeEventListener('abort', onAbort);
  }
}

export function abortableDelay(milliseconds, signal) {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); };
    const cancel = () => { cleanup(); reject(abortReason(signal)); };
    const timer = setTimeout(() => { cleanup(); resolve(); }, milliseconds);
    signal?.addEventListener('abort', cancel, { once: true });
  });
}
