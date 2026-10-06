/**
 * 순위 맞추기 항목 순서. 항목은 정답 순서 그대로 저장되므로 화면에 그대로 보이면 정답이 드러난다.
 */

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

/** 발표 화면용 공개 전 순서 — 문항마다 고정이고, 섞은 결과가 우연히 정답 순서와 같으면 한 칸 돌린다. */
export function boardRankingOrder(items, questionId) {
  const order = shuffleWithSeed(items, `board-${questionId}`);
  const solved = order.every((value, index) => value === index);
  return solved && order.length > 1 ? [...order.slice(1), order[0]] : order;
}
