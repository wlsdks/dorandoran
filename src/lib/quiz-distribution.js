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

/**
 * 활성화 직후에는 강사 화면의 questions 칸(120ms로 묶음)이 currentQuestion보다 늦게 와서 round가 직전 값이다.
 * 그 첫 전송은 규칙이 거부하지만 다음 payload(새 round)가 곧바로 다시 보내므로 정상 동작이다.
 * 같은 범위에서 두 번째로 실패할 때만 진짜 오류로 알린다.
 */
export function shouldReportPublishFailure(failuresInScope) {
  return failuresInScope >= 2;
}

/** 강사 화면이 집계 신호를 보내는 주기. 전자칠판은 이 주기의 3배 넘게 소식이 없으면 연결을 의심한다. */
export const QUIZ_HEARTBEAT_MS = 10000;

/**
 * 전자칠판이 보는 퀴즈 집계가 멈췄는지. 문항이 열린 지 graceMs가 지났는데 집계가 아예 없거나,
 * 마지막 신호(heartbeat)가 3주기 넘게 끊겼으면 true. 서버 예비 경로(functions/quiz-tally.js)가
 * 대신 집계 중이면 false. 시간은 모두 서버 기준(ms).
 */
export function isQuizTallyStale(aggregate, { now, activatedAt = 0, graceMs = 8000 } = {}) {
  if (!Number.isFinite(now)) return false;
  if (!aggregate) return Boolean(activatedAt) && now - activatedAt > graceMs;
  // 강사 신호가 끊긴 동안 서버가 투표마다 다시 세어 올린 집계 — 숫자가 계속 맞으므로 알리지 않는다.
  if (aggregate.source === 'server') return false;
  if (!Number.isFinite(aggregate.heartbeat)) return false; // 신호 없는 예전 집계 — 판단하지 않는다
  return now - aggregate.heartbeat > QUIZ_HEARTBEAT_MS * 3;
}
