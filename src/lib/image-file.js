/** 업로드 가능한 이미지 형식과 거절 사유 — 사용자가 "이 형식은 안 되는구나"를 바로 알 수 있게 형식 이름을 알려준다. */
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const SUPPORTED_IMAGE_LABEL = 'JPG, PNG, GIF, WebP';

const KNOWN = [
  [/heic|heif/i, 'HEIC(아이폰 사진)'],
  [/svg/i, 'SVG'],
  [/bmp/i, 'BMP'],
  [/tiff?/i, 'TIFF'],
  [/avif/i, 'AVIF'],
  [/pdf/i, 'PDF'],
  [/icon|\.ico$/i, 'ICO'],
];

/** 파일 형식 이름 — MIME이 비어 있는 경우(일부 HEIC)도 확장자로 판별한다. */
export function imageFormatName(file) {
  const hint = `${file?.type || ''} ${file?.name || ''}`;
  const known = KNOWN.find(([pattern]) => pattern.test(hint));
  if (known) return known[1];
  const ext = (file?.name || '').split('.').pop();
  return ext && ext !== file?.name ? ext.toUpperCase() : '이';
}

/** 거절 사유 문구. 받을 수 있으면 null. */
export function imageRejection(file, maxSizeMb) {
  if (!file) return null;
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    const name = imageFormatName(file);
    const tip = /HEIC/.test(name) ? ' 아이폰은 설정 › 카메라 › 포맷에서 "높은 호환성"을 고르거나, 사진을 JPG로 저장해 올려주세요.' : '';
    return `${name} 형식은 등록할 수 없어요. ${SUPPORTED_IMAGE_LABEL} 이미지만 올릴 수 있어요.${tip}`;
  }
  if (maxSizeMb && file.size > maxSizeMb * 1024 * 1024) return `${maxSizeMb}MB 이하 이미지만 올릴 수 있어요. (지금 ${(file.size / 1024 / 1024).toFixed(1)}MB)`;
  return null;
}
