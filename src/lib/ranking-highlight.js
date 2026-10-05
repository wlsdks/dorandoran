export const MAX_HIGHLIGHT_RANKS = 10;

export function parseHighlightRanks(text, maxRank = Infinity) {
  const tokens = String(text ?? '').trim().split(/[\s,]+/).filter(Boolean);
  if (!tokens.length) return { error: '강조할 순위 번호를 입력해 주세요.' };
  if (tokens.some(token => !/^\d+$/.test(token))) return { error: '순위는 양의 정수로 입력해 주세요. 쉼표나 공백으로 구분할 수 있어요.' };
  const values = tokens.map(Number);
  if (values.some(value => !Number.isSafeInteger(value) || value < 1)) return { error: '순위는 1 이상의 정수로 입력해 주세요.' };
  const ranks = [...new Set(values)];
  if (ranks.length > MAX_HIGHLIGHT_RANKS) return { error: `한 번에 최대 ${MAX_HIGHLIGHT_RANKS}개 순위를 지정할 수 있어요.` };
  if (ranks.some(rank => rank > maxRank)) return { error: `현재 목록의 순위는 1~${maxRank}위입니다.` };
  return { ranks };
}

export function normalizeRankingHighlight(config) {
  if (!config || config.enabled !== true || !Array.isArray(config.ranks) || !config.ranks.length || config.ranks.length > MAX_HIGHLIGHT_RANKS) return null;
  if (config.ranks.some(rank => !Number.isSafeInteger(rank) || rank < 1)) return null;
  const ranks = [...new Set(config.ranks)];
  if (!Number.isSafeInteger(config.activeRank) || !ranks.includes(config.activeRank)) return null;
  return { ranks, activeRank: config.activeRank, enabled: true };
}

export function nextRankingHighlight(config) {
  const normalized = normalizeRankingHighlight(config);
  if (!normalized) return null;
  const index = normalized.ranks.indexOf(normalized.activeRank);
  return { ...normalized, activeRank: normalized.ranks[(index + 1) % normalized.ranks.length] };
}

export function rankingHighlightEntry(entries, config) {
  const normalized = normalizeRankingHighlight(config);
  return normalized ? entries?.[normalized.activeRank - 1] || null : null;
}
