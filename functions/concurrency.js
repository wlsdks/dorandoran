/** 실행 중인 작업 수만 제한한다. 모든 작업 완료/실패를 기다려 요청 종료 후 배경 작업을 남기지 않는다. */
async function mapConcurrent(values, limit, work) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('동시 작업 수는 양의 정수여야 합니다.');
  const result = new Array(values.length);
  let next = 0;
  let failed = false;
  let error;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (!failed && next < values.length) {
      const index = next++;
      try { result[index] = await work(values[index], index); }
      catch (cause) { failed = true; error = cause; }
    }
  }));
  if (failed) throw error;
  return result;
}
module.exports = { mapConcurrent };
