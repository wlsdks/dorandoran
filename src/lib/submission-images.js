/** 예전 URL 배열과 새 업로드 메타데이터를 표시용으로 맞춘다. 저장 원본은 변경하지 않는다. */
export function submissionImages(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap(image => {
    const item = typeof image === 'string' ? { url: image } : image;
    if (!item || typeof item.url !== 'string') return [];
    try {
      const url = new URL(item.url);
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? [item] : [];
    } catch { return []; }
  });
}
