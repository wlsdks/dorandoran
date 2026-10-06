export const MAX_HIGHLIGHT_RANKS = 10;
const MAX_DISPLAYED_RANK = 200000;

const isRank = value => Number.isSafeInteger(value) && value >= 1 && value <= MAX_DISPLAYED_RANK;

function cleanRanks(ranks) {
  if (!Array.isArray(ranks) || !ranks.length || ranks.length > MAX_HIGHLIGHT_RANKS) return null;
  if (Array.from(ranks).some(rank => !isRank(rank))) return null;
  return [...new Set(ranks)];
}

export function parseHighlightRanks(text, maxRank = MAX_DISPLAYED_RANK) {
  const tokens = String(text ?? '').trim().split(/[\s,]+/).filter(Boolean);
  if (!tokens.length) return { error: '공개할 순위 번호를 입력해 주세요.' };
  if (tokens.some(token => !/^\d+$/.test(token))) return { error: '순위는 양의 정수로 입력해 주세요. 쉼표나 공백으로 구분할 수 있어요.' };
  const values = tokens.map(Number);
  if (values.some(value => !Number.isSafeInteger(value) || value < 1)) return { error: '순위는 1 이상의 정수로 입력해 주세요.' };
  const ranks = [...new Set(values)];
  if (ranks.length > MAX_HIGHLIGHT_RANKS) return { error: `한 번에 최대 ${MAX_HIGHLIGHT_RANKS}개 순위를 지정할 수 있어요.` };
  if (ranks.some(rank => rank > Math.min(maxRank, MAX_DISPLAYED_RANK))) return { error: `현재 목록의 순위는 1~${maxRank}위입니다.` };
  return { ranks };
}

/**
 * The spotlight the board shows right now, or null. Presets that have not been
 * revealed (enabled: false) stay invisible to every viewer.
 */
export function normalizeRankingHighlight(config) {
  if (!config || config.enabled !== true) return null;
  const ranks = cleanRanks(config.ranks);
  if (!ranks || !Number.isSafeInteger(config.activeRank) || !ranks.includes(config.activeRank)) return null;
  return { ranks, activeRank: config.activeRank, enabled: true };
}

/**
 * Instructor view of the stored plan: which ranks were chosen before class and
 * how many have been revealed so far. Legacy data (no revealed field) counts the
 * active rank's position as progress so the next reveal continues after it.
 */
export function normalizeHighlightPreset(config) {
  const ranks = cleanRanks(config?.ranks);
  if (!ranks) return null;
  const active = normalizeRankingHighlight(config);
  const activeRank = active ? active.activeRank : null;
  let revealed = Number.isSafeInteger(config.revealed) ? config.revealed : activeRank ? ranks.indexOf(activeRank) + 1 : 0;
  if (activeRank) revealed = Math.max(revealed, ranks.indexOf(activeRank) + 1);
  revealed = Math.max(0, Math.min(ranks.length, revealed));
  return { ranks, revealed, activeRank, enabled: Boolean(active) };
}

/** Stored shape for a plan made before class: nothing is shown until the first reveal. */
export function presetRankingHighlight(ranks) {
  const cleaned = cleanRanks(ranks);
  return cleaned ? { ranks: cleaned, enabled: false, revealed: 0 } : null;
}

/** Next stored value after pressing "reveal": spotlights the next planned rank, or null when all are shown. */
export function revealNextHighlight(config) {
  const preset = normalizeHighlightPreset(config);
  if (!preset || preset.revealed >= preset.ranks.length) return null;
  return { ranks: preset.ranks, activeRank: preset.ranks[preset.revealed], enabled: true, revealed: preset.revealed + 1 };
}

/** Takes the spotlight off the board but keeps the plan and its progress. */
export function clearHighlightSpotlight(config) {
  const preset = normalizeHighlightPreset(config);
  return preset ? { ranks: preset.ranks, enabled: false, revealed: preset.revealed } : null;
}

/** Rewinds the plan so the next reveal starts from the first planned rank again. */
export function restartHighlightPreset(config) {
  const preset = normalizeHighlightPreset(config);
  return preset ? { ranks: preset.ranks, enabled: false, revealed: 0 } : null;
}

/** Session fields to write for a new highlight value: the board jumps to the page of a revealed rank. */
export function rankingHighlightUpdates(config, pageSize = 8) {
  const preset = normalizeHighlightPreset(config);
  if (!preset) return { leaderboardHighlight: null };
  const stored = preset.enabled
    ? { ranks: preset.ranks, activeRank: preset.activeRank, enabled: true, revealed: preset.revealed }
    : { ranks: preset.ranks, enabled: false, revealed: preset.revealed };
  return { leaderboardHighlight: stored, ...(preset.enabled ? { leaderboardPage: Math.floor((preset.activeRank - 1) / pageSize) } : {}) };
}

export function rankingHighlightEntry(entries, config) {
  const normalized = normalizeRankingHighlight(config);
  return normalized ? entries?.[normalized.activeRank - 1] || null : null;
}
