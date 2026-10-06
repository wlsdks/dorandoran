import { describe, expect, it } from 'vitest';
import { imageRejection } from './image-file';

const f = (name, type, size = 1000) => ({ name, type, size });

describe('이미지 형식 안내', () => {
  it('지원 형식은 통과한다', () => {
    expect(imageRejection(f('a.jpg', 'image/jpeg'), 20)).toBeNull();
    expect(imageRejection(f('a.webp', 'image/webp'), 20)).toBeNull();
  });
  it('HEIC는 MIME이 비어 있어도 형식 이름과 아이폰 안내를 보여준다', () => {
    const msg = imageRejection(f('IMG_0001.HEIC', ''), 20);
    expect(msg).toContain('HEIC');
    expect(msg).toContain('등록할 수 없어요');
    expect(msg).toContain('높은 호환성');
  });
  it('그 밖의 형식도 이름을 알려준다', () => {
    expect(imageRejection(f('logo.svg', 'image/svg+xml'), 20)).toMatch(/^SVG 형식/);
    expect(imageRejection(f('scan.tif', 'image/tiff'), 20)).toMatch(/^TIFF 형식/);
    expect(imageRejection(f('doc.pdf', 'application/pdf'), 20)).toMatch(/^PDF 형식/);
  });
  it('용량 초과는 현재 크기와 함께 알려준다', () => {
    expect(imageRejection(f('big.png', 'image/png', 25 * 1024 * 1024), 20)).toContain('25.0MB');
  });
});

import { sniffImageType, normalizeImageFile } from './image-file';

describe('윈도우 파일 형식 판별', () => {
  const head = (...b) => new Uint8Array([...b, ...new Array(16).fill(0)]).slice(0, 16);
  const ascii = s => [...s].map(c => c.charCodeAt(0));
  it('파일 내용으로 JPG·PNG·GIF·WebP·HEIC를 알아본다', () => {
    expect(sniffImageType(head(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffImageType(head(0x89, ...ascii('PNG')))).toBe('image/png');
    expect(sniffImageType(head(...ascii('GIF89a')))).toBe('image/gif');
    expect(sniffImageType(head(...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')))).toBe('image/webp');
    expect(sniffImageType(head(0, 0, 0, 0x18, ...ascii('ftypheic')))).toBe('image/heic');
  });
  it('윈도우가 형식을 비워 보낸 JPG도 jpeg로 고쳐 받는다', async () => {
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], '사진.jpg', { type: '' });
    const fixed = await normalizeImageFile(file);
    expect(fixed.type).toBe('image/jpeg');
    expect(imageRejection(fixed, 50)).toBeNull();
  });
  it('옛 이름(image/pjpeg)도 jpeg로 고친다', async () => {
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe1])], 'a.jpeg', { type: 'image/pjpeg' });
    expect((await normalizeImageFile(file)).type).toBe('image/jpeg');
  });
  it('확장자가 jpg여도 실제 내용이 HEIC면 HEIC로 안내한다', async () => {
    const file = new File([new Uint8Array([0, 0, 0, 0x18, ...ascii('ftypheic')])], 'IMG.jpg', { type: 'image/jpeg' });
    const fixed = await normalizeImageFile(file);
    expect(imageRejection(fixed, 50)).toContain('HEIC');
  });
});
