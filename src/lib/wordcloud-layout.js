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

/**
 * 빈도 → 크기 단계(0~1, 6단계). 응답 하나가 들어올 때마다 모든 단어가 미세하게 커지며 줄이 다시 바뀌지 않도록,
 * 단계가 바뀔 때만 크기가 변한다. 최다 단어는 항상 1.
 */
export function wordSizeStep(count, maxCount, steps = 5) {
  if (!(maxCount > 0) || !(count > 0)) return 0;
  return Math.min(1, Math.round((count / maxCount) * steps) / steps);
}

/** 단어 수에 따른 줄 수 상한 — 구름이 세로로만 자라지 않고 타원 덩어리로 남는다. */
export function wordCloudMaxLines(count) {
  if (!(count > 0)) return 0;
  if (count <= 3) return 1;
  if (count <= 6) return 2;
  if (count <= 12) return 3;
  if (count <= 20) return 4;
  if (count <= 30) return 5;
  return 6;
}

/** 단어가 늘수록 전체 글자 배율을 줄인다(8개까지 1, 40개면 0.58) — 무대 높이는 고정이다. */
export function wordCloudScale(count) {
  if (!(count > 8)) return 1;
  return Math.max(0.58, Math.round((1 - (count - 8) * 0.015) * 100) / 100);
}

/** 한 줄에 놓인 글자의 어림 폭(em 단위) — 글자 수 × 크기 단계 + 간격. 배치 균형용이라 정확할 필요는 없다. */
function estimatedWidth(text, count, maxCount) {
  return text.length * (0.55 + 0.45 * wordSizeStep(count, maxCount)) + 0.6;
}

/**
 * 전자칠판 줄 단위 배치 — 이미 보이는 단어는 줄과 자리를 지키고, 새 단어만 들어온다.
 * 줄 수가 상한(wordCloudMaxLines)보다 적으면 새 줄을 열고, 아니면 가장 짧은 줄 끝에 붙인다(같으면 가운데 줄).
 * 그래서 200명이 답하는 동안 글자가 자리를 옮기지 않는다 — 줄은 열릴 때만 늘고 비면 빠진다.
 *
 * @param {string[][]} previousLines 직전에 그린 줄별 단어
 * @param {Record<string, number>} tallied 단어별 빈도
 * @param {{ limit?: number, maxLines?: number }} [opts]
 * @returns {Array<Array<{ text: string, count: number, rank: number }>>}
 */
export function layoutWordLines(previousLines, tallied, { limit = 30, maxLines } = {}) {
  const ranked = Object.entries(tallied || {})
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    .slice(0, Math.max(0, limit));
  const rank = new Map(ranked.map((word, index) => [word.text, index]));
  const countOf = (text) => ranked[rank.get(text)].count;
  const maxCount = ranked[0]?.count || 1;
  const lines = (previousLines || []).map((line) => line.filter((text) => rank.has(text))).filter((line) => line.length > 0);
  const seen = new Set(lines.flat());
  const target = maxLines ?? wordCloudMaxLines(ranked.length);
  const widthOf = (line) => line.reduce((sum, text) => sum + estimatedWidth(text, countOf(text), maxCount), 0);
  for (const { text } of ranked) {
    if (seen.has(text)) continue;
    seen.add(text);
    if (lines.length < target) { lines.push([text]); continue; }
    const middle = (lines.length - 1) / 2;
    let best = 0;
    for (let i = 1; i < lines.length; i += 1) {
      const gap = widthOf(lines[i]) - widthOf(lines[best]);
      if (gap < -1e-9 || (Math.abs(gap) < 1e-9 && Math.abs(i - middle) < Math.abs(best - middle))) best = i;
    }
    lines[best].push(text);
  }
  return lines.map((line) => line.map((text) => ({ text, count: countOf(text), rank: rank.get(text) })));
}

/** 전자칠판처럼 답 내용을 숨기는 화면의 응답 버블 글귀 — 모아서 하나로 보여준다. */
export function arrivalLabel(count) {
  return count > 1 ? `+${count} 응답` : '응답';
}
