/**
 * 순위 맞추기 항목 순서. 항목 번호는 고정 이름표이고 정답은 번호 순서(correctAnswer)다.
 * 공개 전 화면이 우연히 정답 순서대로 놓이면 정답이 드러나므로 섞은 뒤 한 번 더 확인한다.
 */
import { identityRankingOrder } from './ranking-answer';

/** seed 문자열로 항상 같은 결과를 내는 섞기. 원래 항목 번호 배열을 돌려준다. */
export function shuffleWithSeed(items, seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  const arr = items.map((item, i) => ({ item, i }));
  for (let i = arr.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    const j = h % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.map((a) => a.i);
}

const sameOrder = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);

/**
 * 발표 화면용 공개 전 순서 — 문항마다 고정이고, 섞은 결과가 우연히 정답 순서(correctOrder, 기본은 저장 순서)와
 * 같으면 한 칸 돌린다(항목이 2개 이상이면 한 칸 돌린 순열은 원래와 항상 다르다).
 */
export function boardRankingOrder(items, questionId, correctOrder = identityRankingOrder(items.length)) {
  const order = shuffleWithSeed(items, `board-${questionId}`);
  return sameOrder(order, correctOrder) && order.length > 1 ? [...order.slice(1), order[0]] : order;
}
