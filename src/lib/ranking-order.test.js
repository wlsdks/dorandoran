import { describe, expect, it } from 'vitest';
import { boardRankingOrder, rankingItemLabels, shuffleWithSeed } from './ranking-order';

describe('순위 맞추기 항목 순서', () => {
  it('같은 seed는 항상 같은 순서를 내고 모든 항목을 한 번씩 담는다', () => {
    const items = ['A', 'B', 'C', 'D', 'E'];
    expect(shuffleWithSeed(items, 'q-p1')).toEqual(shuffleWithSeed(items, 'q-p1'));
    expect([...shuffleWithSeed(items, 'q-p1')].sort()).toEqual([0, 1, 2, 3, 4]);
  });
  it('발표 화면은 공개 전에 정답 순서(저장 순서)를 그대로 보여주지 않는다', () => {
    for (let n = 2; n <= 6; n++) {
      const items = Array.from({ length: n }, (_, i) => `항목${i}`);
      for (let q = 0; q < 200; q++) {
        const order = boardRankingOrder(items, `q${q}`);
        expect([...order].sort((a, b) => a - b)).toEqual(items.map((_, i) => i));
        expect(order).not.toEqual(items.map((_, i) => i));
      }
    }
  });
  it('항목 번호는 발표 화면 표시 순서를 따르고, 정답 순서로 읽으면 섞인 번호열이 된다', () => {
    const items = ['DNS 조회', 'TCP 연결', 'HTTP 요청', '응답 렌더링'];
    const order = boardRankingOrder(items, 'q1');
    const labels = rankingItemLabels(items, 'q1');
    order.forEach((itemIndex, position) => expect(labels[itemIndex]).toBe('①②③④'[position]));
    expect(labels.join('')).not.toBe('①②③④');
  });
});
