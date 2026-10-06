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
