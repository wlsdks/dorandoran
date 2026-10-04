const TIMEOUT_MS = 5000;

/** 크기와 디코딩을 확인한 후 고해상도 텍스트를 보존한다. 모든 종료 경로에서 URL을 해제한다. */
export function compressImage(file, { maxWidth = 2560, maxHeight = 1440, quality = 0.9 } = {}) {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) return Promise.reject(new Error('지원하지 않는 이미지 형식입니다.'));
  return new Promise((resolve, reject) => {
    let done = false;
    const image = new Image();
    const url = URL.createObjectURL(file);
    const finish = (blob, error) => {
      if (done) return;
      done = true; clearTimeout(timeout); URL.revokeObjectURL(url);
      image.onload = null; image.onerror = null;
      if (error) { image.src = ''; reject(error); } else resolve(blob);
    };
    const timeout = setTimeout(() => finish(null, new Error('이미지 크기를 줄인 뒤 다시 시도해주세요.')), TIMEOUT_MS);
    image.onload = () => {
      try {
        const { naturalWidth: width, naturalHeight: height } = image;
        if (!width || !height || width * height > 40_000_000) throw new Error('이미지 해상도가 너무 큽니다.');
        const ratio = Math.min(1, maxWidth / width, maxHeight / height);
        if (ratio === 1 && file.size <= 2 * 1024 * 1024) { finish(file); return; }
        if (file.type === 'image/gif') throw new Error('GIF는 2MB 이하의 작은 이미지로 업로드해주세요.');
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * ratio)); canvas.height = Math.max(1, Math.round(height * ratio));
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => blob ? finish(blob) : finish(null, new Error('이미지를 처리하지 못했습니다.')), 'image/webp', quality);
      } catch (error) { finish(null, error); }
    };
    image.onerror = () => finish(null, new Error('이미지 파일을 확인해주세요.'));
    image.decoding = 'async'; image.src = url;
  });
}
