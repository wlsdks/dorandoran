/**
 * 워드클라우드 자리 배치 — 단어는 처음 나타난 자리를 지킨다.
 *
 * 집계가 바뀔 때마다 "많이 나온 단어를 가운데로" 다시 정렬하면 200명이 답하는 동안 구름 전체가
 * 매번 튀어 다닌다(전자칠판 CLS 4.6). 대신 이미 보이는 단어는 상대 순서를 유지하고, 새 단어만
 * 가운데에서 바깥쪽으로 좌·우 번갈아 붙인다 — 구름이 중심에서 자라나고, 크기(빈도)만 부드럽게 변한다.
 *
 * @param {string[]} previousOrder 직전에 그린 단어 순서(왼쪽→오른쪽)
 * @param {Record<string, number>} tallied 단어별 빈도
 * @param {number} limit 보여줄 최대 단어 수
 * @returns {Array<{ text: string, count: number, rank: number }>} 그릴 순서. rank는 빈도 순위(0 = 최다)
 */
export function arrangeWordCloud(previousOrder, tallied, limit) {
  const ranked = Object.entries(tallied || {})
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    .slice(0, Math.max(0, limit));
  const rank = new Map(ranked.map((word, index) => [word.text, index]));
  const order = (previousOrder || []).filter((text) => rank.has(text));
  const seen = new Set(order);
  for (const { text } of ranked) {
    if (seen.has(text)) continue;
    seen.add(text);
    if (order.length % 2) order.unshift(text); else order.push(text);
  }
  return order.map((text) => ({ text, count: ranked[rank.get(text)].count, rank: rank.get(text) }));
}
