import { describe, expect, it } from 'vitest';
import { fitWithin, uploadErrorMessage, MAX_UPLOAD_MB } from './image-utils';

describe('사진 축소 크기', () => {
  it('4800만 화소 사진도 발표용 2560x1440 안으로 비율을 지켜 줄인다', () => {
    expect(fitWithin(8064, 6048, 1920, 1440)).toMatchObject({ width: 1920, height: 1440 });
    expect(fitWithin(6048, 8064, 2560, 1440)).toMatchObject({ width: 1080, height: 1440 });
  });
  it('작은 사진은 키우지 않는다', () => {
    expect(fitWithin(800, 600, 2560, 1440)).toMatchObject({ width: 800, height: 600, ratio: 1 });
  });
  it('원본 허용 크기는 휴대폰 고해상도 사진을 받을 만큼 넉넉하다', () => {
    expect(MAX_UPLOAD_MB).toBeGreaterThanOrEqual(50);
  });
  it('저장소 오류는 이유가 보이는 문구로 바꾼다', () => {
    expect(uploadErrorMessage({ code: 'storage/unauthorized' })).toContain('권한');
    expect(uploadErrorMessage(new Error('x'))).toContain('다시 시도');
  });
});
