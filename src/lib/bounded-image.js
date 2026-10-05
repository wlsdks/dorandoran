import { abortReason, throwIfAborted, withDeadline } from './async-work';

/** 읽는 도중 크기를 검사해 무제한 다운로드·base64 중복 보관을 막는다. */
export function urlToInlinePart(url, { signal, maxBytes = 2 * 1024 * 1024 } = {}) {
  return withDeadline(async requestSignal => {
    const response = await fetch(url, { signal: requestSignal });
    if (!response.ok) throw new Error(`이미지 다운로드 실패 (${response.status})`);
    const tooLarge = () => new Error('심사용 이미지가 너무 큽니다. 이미지를 줄여 다시 제출해주세요.');
    if (Number(response.headers.get('content-length')) > maxBytes) {
      await response.body?.cancel(); throw tooLarge();
    }
    const reader = response.body?.getReader();
    let blob;
    if (reader) {
      const chunks = []; let bytes = 0;
      try {
        while (true) {
          throwIfAborted(requestSignal);
          const { value, done } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > maxBytes) throw tooLarge();
          chunks.push(value);
        }
        blob = new Blob(chunks, { type: response.headers.get('content-type') || 'image/jpeg' });
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    } else {
      blob = await response.blob();
      if (blob.size > maxBytes) throw tooLarge();
    }
    throwIfAborted(requestSignal);
    const data = await new Promise((resolve, reject) => {
      const file = new FileReader();
      const cleanup = () => requestSignal.removeEventListener('abort', cancel);
      const cancel = () => { cleanup(); file.abort(); reject(abortReason(requestSignal)); };
      file.onload = () => { cleanup(); typeof file.result === 'string' ? resolve(file.result.split(',')[1] || '') : reject(new Error('이미지 읽기 실패')); };
      file.onerror = () => { cleanup(); reject(file.error || new Error('이미지 읽기 실패')); };
      requestSignal.addEventListener('abort', cancel, { once: true });
      file.readAsDataURL(blob);
    });
    return { inlineData: { mimeType: blob.type, data } };
  }, 20000, { signal, message: '이미지 다운로드 타임아웃' });
}
