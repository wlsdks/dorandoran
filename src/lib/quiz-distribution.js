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
