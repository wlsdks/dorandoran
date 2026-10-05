/** 클라이언트가 나가거나 제한을 넘으면 전송·응답 스트림을 취소한다. */
async function fetchUpstream(url, options, response, { timeoutMs = 30_000, maxBytes = 6 * 1024 * 1024 } = {}) {
  const controller = new AbortController();
  const close = () => { if (!response.writableEnded) controller.abort(); };
  response.on('close', close);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let reader;
  try {
    if (response.destroyed) controller.abort();
    const upstream = await fetch(url, { ...options, signal: controller.signal });
    if (!upstream.ok) { await upstream.body?.cancel(); return { status: upstream.status, ok: false }; }
    if (Number(upstream.headers.get('content-length')) > maxBytes) throw new Error('업스트림 응답 크기 초과');
    const chunks = []; let size = 0;
    reader = upstream.body.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error('업스트림 응답 크기 초과');
      chunks.push(Buffer.from(value));
    }
    return { ok: true, status: upstream.status, contentType: upstream.headers.get('content-type'), text: Buffer.concat(chunks).toString('utf8') };
  } finally {
    clearTimeout(timer); response.off('close', close); controller.abort();
    if (reader) { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
}
module.exports = { fetchUpstream };
