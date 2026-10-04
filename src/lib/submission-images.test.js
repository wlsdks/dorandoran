import { describe, expect, it } from 'vitest';
import { submissionImages } from './submission-images';

describe('기존 과제 이미지 표시 호환성', () => {
  it('예전 URL과 새 메타데이터를 함께 표시하고 저장 원본은 보존한다', () => {
    const images = ['https://example.com/old.png', { url: 'https://example.com/new.png', name: 'new.png', path: 'assignments/a/u/new.png', size: 100 }];
    const original = structuredClone(images);
    expect(submissionImages(images)).toEqual([{ url: images[0] }, images[1]]);
    expect(images).toEqual(original);
  });
  it('실행 가능한 주소, 자격증명 포함 주소와 깨진 레거시 항목은 표시하지 않는다', () => {
    expect(submissionImages(['javascript:alert(1)', 'data:text/html,test', 'https://user:password@example.com/a.png', null, {}, 'bad-url'])).toEqual([]);
    expect(submissionImages(null)).toEqual([]);
  });
});
