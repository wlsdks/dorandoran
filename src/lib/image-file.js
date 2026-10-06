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

/**
 * 파일 앞부분(매직 넘버)으로 실제 형식을 판별한다.
 * 윈도우는 레지스트리에 따라 file.type이 비어 있거나("") image/pjpeg·image/x-png 같은 옛 이름을 주므로
 * 브라우저가 알려준 MIME만 믿으면 멀쩡한 JPG도 거절된다.
 */
export function sniffImageType(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const ascii = (from, to) => String.fromCharCode(...b.subarray(from, to));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (ascii(0, 4) === 'GIF8') return 'image/gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(4, 8) === 'ftyp' && /^(heic|heix|hevc|hevx|mif1|msf1|heim|heis)$/.test(ascii(8, 12))) return 'image/heic';
  if (ascii(4, 8) === 'ftyp' && /^avi[fs]$/.test(ascii(8, 12))) return 'image/avif';
  if (b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp';
  if ((b[0] === 0x49 && b[1] === 0x49) || (b[0] === 0x4d && b[1] === 0x4d)) return 'image/tiff';
  return '';
}

const MIME_ALIASES = { 'image/pjpeg': 'image/jpeg', 'image/jpg': 'image/jpeg', 'image/x-png': 'image/png', 'image/x-citrix-jpeg': 'image/jpeg', 'image/x-citrix-png': 'image/png' };

/** 실제 형식을 확인해, 지원 형식이면 올바른 MIME을 붙인 File로 돌려준다(윈도우 대응). */
export async function normalizeImageFile(file) {
  if (!file) return file;
  let sniffed;
  try {
    sniffed = sniffImageType(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  } catch (error) {
    // 윈도우에서 자주 나는 경우: 캡처 도구가 아직 파일을 쓰는 중이거나, OneDrive 등 클라우드에만 있는(내려받지 않은) 파일,
    // 보안 프로그램이 검사 중이라 잠긴 파일. 조용히 넘기면 아무 반응 없이 실패하므로 이유를 알린다.
    const unreadable = new Error('사진 파일을 열 수 없어요. 방금 만든 캡처라면 잠시 후 다시 시도하거나, 바탕화면에 저장한 뒤 그 파일을 올려주세요. (OneDrive 등 클라우드에만 있는 파일은 먼저 내려받아 주세요)');
    unreadable.code = 'file/unreadable';
    unreadable.cause = error;
    throw unreadable;
  }
  const type = sniffed || MIME_ALIASES[file.type] || file.type;
  if (type === file.type) return file;
  return new File([file], file.name, { type, lastModified: file.lastModified });
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
