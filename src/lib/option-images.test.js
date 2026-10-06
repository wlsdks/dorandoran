import { describe, expect, it } from 'vitest';
import { choiceNames, hasOptionImages, isAutoPhotoName } from './option-images';

describe('보기 사진', () => {
  it('사진만 있는 보기는 자동 이름을 받고, 그 이름은 화면에서 숨길 대상으로 인식된다', () => {
    const names = choiceNames(['', '토끼', ''], ['a.png', 'b.png', '']);
    expect(names).toEqual(['사진 A', '토끼', '']);
    expect(isAutoPhotoName(names[0])).toBe(true);
    expect(isAutoPhotoName('토끼')).toBe(false);
    expect(isAutoPhotoName('사진 AB')).toBe(false);
  });
  it('사진이 하나라도 있어야 사진 보기로 본다', () => {
    expect(hasOptionImages(['', ''])).toBe(false);
    expect(hasOptionImages(['', 'x.png'])).toBe(true);
    expect(hasOptionImages(null)).toBe(false);
  });
});
