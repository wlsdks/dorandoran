import { describe, expect, it } from 'vitest';
import { boardRankingOrder, shuffleWithSeed } from './ranking-order';

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
  it('정답이 번호 순서(예: 0,2,3,1)일 때도 공개 전 순서는 정답과 절대 같지 않다', () => {
    const items = ['DNS 조회', '렌더링', '요청 전송', '응답 생성'];
    for (const correct of [[0, 2, 3, 1], [3, 2, 1, 0], [1, 0, 3, 2]]) {
      for (let q = 0; q < 300; q++) {
        const order = boardRankingOrder(items, `q${q}`, correct);
        expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
        expect(order).not.toEqual(correct);
      }
    }
    // 섞은 결과가 정답과 같을 때는 한 칸 돌리고, 돌린 결과도 모든 항목을 한 번씩 담는다.
    const shuffled = shuffleWithSeed(items, 'board-q7');
    expect(boardRankingOrder(items, 'q7', shuffled)).toEqual([...shuffled.slice(1), shuffled[0]]);
  });
});
