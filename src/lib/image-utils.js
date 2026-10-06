/** 업로드 전 이미지 축소. 휴대폰 고해상도 사진(4800만 화소, 30MB대)도 받아서 발표용 해상도로 줄인다. */
export const MAX_UPLOAD_MB = 50;
const MAX_PIXELS = 120_000_000;
const STORAGE_LIMIT = 9.5 * 1024 * 1024; // storage.rules 10MB보다 여유 있게
const TIMEOUT_MS = 30_000;

class ImageError extends Error {}

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new ImageError('사진을 처리하는 데 시간이 너무 오래 걸려요. 다른 사진으로 다시 시도해주세요.')), ms); }),
  ]).finally(() => clearTimeout(timer));
}

/** 크기 계산: 비율을 유지한 채 상자 안에 맞춘다. */
export function fitWithin(width, height, maxWidth, maxHeight) {
  const ratio = Math.min(1, maxWidth / width, maxHeight / height);
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)), ratio };
}

async function decodeSize(file) {
  // createImageBitmap은 디코딩을 메인 스레드 밖에서 처리해 큰 사진도 화면이 멈추지 않는다.
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close?.() };
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  try { await image.decode(); } catch { URL.revokeObjectURL(url); throw new ImageError('사진 파일을 읽지 못했어요. 다른 사진으로 시도해주세요.'); }
  return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) };
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new ImageError('사진을 처리하지 못했어요. 다시 시도해주세요.')), type, quality));
}

export function compressImage(file, { maxWidth = 2560, maxHeight = 1440, quality = 0.9 } = {}) {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) return Promise.reject(new ImageError('지원하지 않는 이미지 형식이에요.'));
  return withTimeout((async () => {
    let decoded;
    try { decoded = await decodeSize(file); } catch (error) { throw error instanceof ImageError ? error : new ImageError('사진 파일을 읽지 못했어요. 다른 사진으로 시도해주세요.'); }
    try {
      const { width, height } = decoded;
      if (!width || !height) throw new ImageError('사진 파일을 읽지 못했어요.');
      if (width * height > MAX_PIXELS) throw new ImageError(`사진 해상도가 너무 커요(${Math.round(width * height / 1e6)}백만 화소). 1억 화소 이하 사진을 올려주세요.`);
      const target = fitWithin(width, height, maxWidth, maxHeight);
      if (target.ratio === 1 && file.size <= 2 * 1024 * 1024) return file;
      if (file.type === 'image/gif') {
        if (file.size <= STORAGE_LIMIT) return file; // 움직이는 GIF는 그대로 둔다
        throw new ImageError('GIF는 9MB 이하로 올려주세요.');
      }
      const canvas = document.createElement('canvas');
      canvas.width = target.width; canvas.height = target.height;
      const context = canvas.getContext('2d');
      context.imageSmoothingQuality = 'high';
      context.drawImage(decoded.source, 0, 0, target.width, target.height);
      // 대부분 1~2MB로 끝나지만, 아주 복잡한 사진은 품질을 낮춰 저장소 한도(10MB) 아래로 맞춘다.
      for (const q of [quality, 0.8, 0.7, 0.55]) {
        const blob = await toBlob(canvas, 'image/webp', q);
        if (blob.size <= STORAGE_LIMIT) return blob;
      }
      throw new ImageError('사진이 너무 복잡해서 줄이지 못했어요. 다른 사진으로 시도해주세요.');
    } finally { decoded.close(); }
  })(), TIMEOUT_MS);
}

/** 사용자에게 보여줄 오류 문구 — 우리가 만든 안내는 그대로, 그 밖의 오류는 일반 문구로. */
export function uploadErrorMessage(error) {
  if (error instanceof ImageError) return error.message;
  if (error?.code === 'storage/unauthorized') return '사진을 올릴 권한이 없어요. 다시 로그인한 뒤 시도해주세요.';
  if (error?.code === 'storage/retry-limit-exceeded' || error?.code === 'storage/canceled') return '네트워크가 불안정해 업로드하지 못했어요. 다시 시도해주세요.';
  return '업로드하지 못했어요. 다시 시도해주세요.';
}
