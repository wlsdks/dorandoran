const MAX_RESPONSES = 200000;

/** Only option counts are broadcast. Individual votes and the correct answer stay private. */
export function quizDistribution(options, countByValue, round = 0) {
  const counts = options.map(option => countByValue(option));
  const total = [...new Set(options)].reduce((sum, option) => sum + countByValue(option), 0);
  return { round, total, counts };
}

/** An old round must never flash its results during reset or reactivation. */
export function readQuizDistribution(value, options, round = 0) {
  if (!value || value.round !== round || !Number.isSafeInteger(value.total) || value.total < 0 || value.total > MAX_RESPONSES) return null;
  const tallied = Object.create(null);
  for (let index = 0; index < options.length; index++) {
    const count = value.counts?.[index];
    if (!Number.isSafeInteger(count) || count < 0 || count > value.total) return null;
    tallied[options[index]] = count;
  }
  if (Object.values(tallied).reduce((sum, count) => sum + count, 0) !== value.total) return null;
  return { tallied, totalVotes: value.total };
}

/** 강사 화면이 집계 신호를 보내는 주기. 전자칠판은 이 주기의 3배 넘게 소식이 없으면 연결을 의심한다. */
export const QUIZ_HEARTBEAT_MS = 10000;

/**
 * 전자칠판이 보는 퀴즈 집계가 멈췄는지. 문항이 열린 지 graceMs가 지났는데 집계가 아예 없거나,
 * 마지막 신호(heartbeat)가 3주기 넘게 끊겼으면 true. 시간은 모두 서버 기준(ms).
 */
export function isQuizTallyStale(aggregate, { now, activatedAt = 0, graceMs = 8000 } = {}) {
  if (!Number.isFinite(now)) return false;
  if (!aggregate) return Boolean(activatedAt) && now - activatedAt > graceMs;
  if (!Number.isFinite(aggregate.heartbeat)) return false; // 신호 없는 예전 집계 — 판단하지 않는다
  return now - aggregate.heartbeat > QUIZ_HEARTBEAT_MS * 3;
}
