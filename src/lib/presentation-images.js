const MAX_IMAGES = 4;
const cache = new Map();
let consumers = 0;

function trim() {
  while (cache.size > MAX_IMAGES) {
    const [key, entry] = cache.entries().next().value;
    cache.delete(key);
    entry.cancel();
  }
}

/** 디코딩된 인접 슬라이드 4개까지만 보관한다. 실패/취소도 promise를 완료한다. */
export function prepareImage(url, priority = 'low') {
  if (cache.has(url)) {
    const entry = cache.get(url); cache.delete(url); cache.set(url, entry); return entry.promise;
  }
  const image = new Image();
  image.decoding = 'async'; image.fetchPriority = priority;
  let complete = false;
  let rejectRequest;
  const entry = {
    cancel() {
      if (!complete) { complete = true; rejectRequest(new DOMException('이미지 준비 취소', 'AbortError')); image.src = ''; }
      image.onload = null; image.onerror = null;
    },
    promise: new Promise((resolve, reject) => {
      rejectRequest = reject;
      image.onload = async () => {
        try {
          if (image.decode) await image.decode();
          if (complete) return;
          complete = true; image.onload = null; image.onerror = null; resolve(url);
        } catch { if (!complete) { complete = true; cache.delete(url); image.onload = null; image.onerror = null; reject(new Error('이미지를 불러오지 못했습니다.')); } }
      };
      image.onerror = () => { if (!complete) { complete = true; image.onload = null; image.onerror = null; cache.delete(url); reject(new Error('이미지를 불러오지 못했습니다.')); } };
      image.src = url;
    }),
  };
  entry.promise.catch(() => {});
  cache.set(url, entry); trim(); return entry.promise;
}
export function retainImageCache() {
  consumers++;
  return () => { if (--consumers === 0) { cache.forEach(entry => entry.cancel()); cache.clear(); } };
}
export function imageCacheSize() { return cache.size; }
