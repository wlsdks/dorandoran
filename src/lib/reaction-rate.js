/**
 * 반응 보내기 속도 조절 — 연속 3번까지는 바로 보내고, 그 뒤로는 1초마다 한 번씩 다시 채워진다(토큰 버킷).
 * 한 번 누를 때마다 3초씩 막던 방식보다 훨씬 덜 답답하고, 초당 1회로 장기 평균을 묶어 DB가 넘치지 않는다.
 */
export const REACTION_BURST = 3;
export const REACTION_REFILL_MS = 1000;

export function createReactionBucket({ burst = REACTION_BURST, refillMs = REACTION_REFILL_MS } = {}) {
  return { tokens: burst, updatedAt: null, burst, refillMs };
}

function refill(bucket, now) {
  if (bucket.updatedAt == null) return { ...bucket, updatedAt: now };
  const gained = Math.floor((now - bucket.updatedAt) / bucket.refillMs);
  if (gained <= 0) return bucket;
  const tokens = Math.min(bucket.burst, bucket.tokens + gained);
  // 가득 차면 기준 시각을 지금으로, 아니면 채운 만큼만 앞당겨 남은 진행분을 보존한다.
  return { ...bucket, tokens, updatedAt: tokens === bucket.burst ? now : bucket.updatedAt + gained * bucket.refillMs };
}

/** 한 번 보내기 시도. allowed면 보내고, 아니면 waitMs 뒤에 다시 가능하다. */
export function takeReaction(bucket, now) {
  const current = refill(bucket, now);
  if (current.tokens > 0) return { allowed: true, bucket: { ...current, tokens: current.tokens - 1 }, waitMs: 0 };
  return { allowed: false, bucket: current, waitMs: Math.max(0, current.updatedAt + current.refillMs - now) };
}

/** 보내지 못한 시도는 토큰을 돌려준다(네트워크 실패 등). */
export function refundReaction(bucket) {
  return { ...bucket, tokens: Math.min(bucket.burst, bucket.tokens + 1) };
}
