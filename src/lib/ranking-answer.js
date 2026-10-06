/**
 * 순위 맞추기 정답 모델 — "번호 고정 + 정답 번호순".
 *
 * 항목은 강사가 입력한 표시 순서 그대로 저장되고, 그 자리 번호(1..N)가 어디서나 같은 이름표가 된다.
 * 정답은 항목 번호(0부터)를 정답 순서로 나열한 문자열이다. 예: 항목 [DNS, 렌더링, 요청, 응답] 에 정답 "0,2,3,1".
 * 예전 문항은 항목을 정답 순서로 저장하고 correctAnswer가 "0,1,…,n-1"이다 — 같은 규칙으로 그대로 읽힌다.
 * 투표 값도 같은 형식(항목 번호 순서)이라 정답 판정은 문자열 완전 일치다.
 */

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
const ORDINALS = ['첫 번째', '두 번째', '세 번째', '네 번째', '다섯 번째', '여섯 번째', '일곱 번째', '여덟 번째', '아홉 번째', '열 번째'];

/** "0,2,3,1" 또는 [0,2,3,1] → 항목 번호 배열. count개 항목을 정확히 한 번씩 담지 않으면 null. */
export function parseRankingOrder(value, count) {
  if (!Number.isInteger(count) || count <= 0) return null;
  let parts;
  if (Array.isArray(value)) parts = value;
  else if (typeof value === 'string' && value.trim()) parts = value.split(',');
  else return null;
  if (parts.length !== count) return null;
  const order = parts.map((part) => (typeof part === 'string' ? (/^\d+$/.test(part.trim()) ? Number(part.trim()) : NaN) : part));
  if (!order.every((index) => Number.isInteger(index) && index >= 0 && index < count)) return null;
  return new Set(order).size === count ? order : null;
}

/** 항목 번호 배열 → 저장 문자열 "0,2,3,1". */
export function serializeRankingOrder(order) {
  return order.map(String).join(',');
}

export function identityRankingOrder(count) {
  return Array.from({ length: Math.max(0, count) }, (_, index) => index);
}

/** 정답 순서 — 읽을 수 없으면(예전 문항·빈 값) 저장 순서를 정답으로 본다. */
export function correctRankingOrder(options = [], correctAnswer) {
  return parseRankingOrder(correctAnswer, options.length) || identityRankingOrder(options.length);
}

/** 저장할 정답 문자열. 올바른 순서가 아니면 저장 순서(예전 형식)로 채운다. */
export function normalizeRankingAnswer(value, count) {
  return serializeRankingOrder(parseRankingOrder(value, count) || identityRankingOrder(count));
}

/** 정답 순서 편집 중 — 모든 항목 번호가 한 번씩 들어갔는지. */
export function isCompleteRankingOrder(order, count) {
  return parseRankingOrder(order, count) !== null;
}

/** 항목을 지웠을 때 정답 순서를 다시 맞춘다 — 지운 번호는 빼고, 뒤 번호는 한 칸 당긴다. */
export function removeRankingItem(order, removedIndex) {
  return (order || []).filter((index) => index !== removedIndex).map((index) => (index > removedIndex ? index - 1 : index));
}

/** 화면 번호(1부터). */
export function rankingNumber(index) {
  return index + 1;
}

/** 글자용 번호 ①②③…(10개 넘으면 "11." 식). */
export function rankingCircled(index) {
  return CIRCLED[index] || `${index + 1}.`;
}

/** 자리 이름 — 첫 번째·두 번째… */
export function rankingOrdinal(position) {
  return ORDINALS[position] || `${position + 1}번째`;
}

/** "1 → 3 → 4 → 2" (circled: "① → ③ → ④ → ②"). 읽기 전용 문구·aria 라벨용. */
export function formatRankingSequence(order = [], { circled = false, options = null } = {}) {
  return order.map((index) => {
    const label = circled ? rankingCircled(index) : String(rankingNumber(index));
    return options?.[index] ? `${label} ${options[index]}` : label;
  }).join(' → ');
}

/** 자리마다 내 답이 정답과 같은지. 답이 없으면 모두 null. */
export function rankingPositionHits(correctOrder, mine) {
  return correctOrder.map((index, position) => (mine ? mine[position] === index : null));
}

/**
 * 공개 화면 집계 — 자리별 맞힌 수와 전부 맞힌 수.
 * 응답이 0명이어도 정답 순서 행은 그대로 나온다(맞힌 수 0).
 */
export function rankingPositionStats(votes = {}, correctOrder = []) {
  const count = correctOrder.length;
  const positionCorrect = new Array(count).fill(0);
  let totalVoters = 0;
  let perfectCount = 0;
  for (const vote of Object.values(votes || {})) {
    const order = parseRankingOrder(vote?.value, count);
    if (!order) continue;
    totalVoters += 1;
    let allCorrect = true;
    order.forEach((index, position) => {
      if (index === correctOrder[position]) positionCorrect[position] += 1;
      else allCorrect = false;
    });
    if (allCorrect) perfectCount += 1;
  }
  const positions = correctOrder.map((itemIndex, position) => ({
    position,
    itemIndex,
    correct: positionCorrect[position],
    pct: totalVoters ? Math.round((positionCorrect[position] / totalVoters) * 100) : 0,
  }));
  return { totalVoters, perfectCount, positions };
}
