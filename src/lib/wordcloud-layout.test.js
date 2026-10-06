import { describe, expect, it } from 'vitest';
import { arrangeWordCloud, wordSizeStep, arrivalLabel } from './wordcloud-layout';

const texts = (words) => words.map((w) => w.text);

describe('워드클라우드 자리 배치', () => {
  it('첫 배치는 최다 단어를 가운데에 두고 좌우로 번갈아 붙인다', () => {
    const words = arrangeWordCloud([], { 집중: 5, 배움: 4, 친구: 3, 열정: 2 }, 40);
    expect(texts(words)).toEqual(['열정', '배움', '집중', '친구']);
    expect(words.map((w) => w.rank)).toEqual([3, 1, 0, 2]);
  });

  it('이미 보이는 단어는 빈도가 바뀌어도 자리를 지킨다 — 구름이 튀지 않는다', () => {
    const first = arrangeWordCloud([], { 집중: 5, 배움: 4 }, 40);
    const next = arrangeWordCloud(texts(first), { 집중: 5, 배움: 9 }, 40);
    expect(texts(next)).toEqual(texts(first));
    expect(next.find((w) => w.text === '배움')).toEqual({ text: '배움', count: 9, rank: 0 });
  });

  it('새 단어는 바깥쪽 끝에 번갈아 붙고, 상한을 넘어 밀려난 단어는 빠진다', () => {
    const first = arrangeWordCloud([], { 집중: 5, 배움: 4, 친구: 3 }, 3);
    const next = arrangeWordCloud(texts(first), { 집중: 5, 배움: 4, 친구: 3, 열정: 9 }, 3);
    expect(texts(next)).toEqual(['배움', '집중', '열정']);
    const grown = arrangeWordCloud(texts(next), { 집중: 5, 배움: 4, 열정: 9, 호기심: 1, 성장: 1 }, 5);
    expect(texts(grown)).toEqual(['성장', '배움', '집중', '열정', '호기심']);
    expect(grown.map((w) => w.rank)).toEqual([3, 2, 1, 0, 4]);
  });

  it('빈 집계와 예약된 문자열을 안전하게 다룬다', () => {
    expect(arrangeWordCloud([], {}, 12)).toEqual([]);
    expect(arrangeWordCloud(['사라짐'], null, 12)).toEqual([]);
    expect(texts(arrangeWordCloud([], JSON.parse('{"__proto__":2,"constructor":1}'), 12))).toEqual(['constructor', '__proto__']);
  });
});

describe('단어 크기 단계와 응답 버블 글귀', () => {
  it('빈도를 6단계로 끊고 최다 단어는 항상 1이다', () => {
    expect(wordSizeStep(10, 10)).toBe(1);
    expect(wordSizeStep(1, 10)).toBe(0.2);
    expect(wordSizeStep(1, 100)).toBe(0);
    expect(wordSizeStep(3, 10)).toBe(0.4);
    expect(wordSizeStep(4, 10)).toBe(0.4);
    expect(wordSizeStep(0, 0)).toBe(0);
  });
  it('모은 응답 수를 한 버블로 적는다', () => {
    expect(arrivalLabel(1)).toBe('응답');
    expect(arrivalLabel(12)).toBe('+12 응답');
  });
});
