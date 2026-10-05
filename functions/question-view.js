const fields = require('./public-question-fields.json');
const { metadataList } = require('./metadata');
const pendingByDatabase = new WeakMap();

async function createQuestionView(db, sessionId) {
  const target = db.ref(`sessions/${sessionId}/publicQuestions`);
  if ((await target.orderByKey().limitToFirst(1).get()).exists()) return;
  const rows = await metadataList(db, `sessions/${sessionId}/questions`, [...fields, 'correctAnswer', 'acceptableAnswers']);
  const view = Object.fromEntries(rows.map(({ id, correctAnswer, acceptableAnswers, ...raw }) => {
    const value = Object.fromEntries(Object.entries(raw).filter(([, field]) => field != null));
    if (value.revealedAt || value.answerRevealed === true) {
      if (correctAnswer != null) value.correctAnswer = correctAnswer;
      if (acceptableAnswers != null) value.acceptableAnswers = acceptableAnswers;
    }
    if (Array.isArray(value.hints)) value.hints = value.hints.slice(0, Number(value.revealedHints) || 0);
    return [id, value];
  }));
  // 보기용 데이터만 추가한다. 레거시 질문과 투표는 변경하지 않는다.
  // 초기 준비 중 강사가 최신 뷰를 발행했다면 덮어쓰지 않는다.
  await target.transaction(current => current === null ? view : undefined);
}
function ensureQuestionView(db, sessionId) {
  let pending = pendingByDatabase.get(db);
  if (!pending) { pending = new Map(); pendingByDatabase.set(db, pending); }
  if (pending.has(sessionId)) return pending.get(sessionId);
  const task = createQuestionView(db, sessionId).finally(() => {
    if (pending.get(sessionId) === task) pending.delete(sessionId);
  });
  pending.set(sessionId, task);
  return task;
}
module.exports = { ensureQuestionView };
