const fields = require('./public-question-fields.json');
const { metadataList } = require('./metadata');
const pendingByDatabase = new WeakMap();
// 정답 공개 뒤에만 공개 뷰에 싣는 필드. 클라이언트(src/lib/public-questions.js)·RTDB 규칙과 같아야 한다.
const REVEALED_FIELDS = ['correctAnswer', 'acceptableAnswers', 'answerImageUrl'];

async function createQuestionView(db, sessionId) {
  const target = db.ref(`sessions/${sessionId}/publicQuestions`);
  if ((await target.orderByKey().limitToFirst(1).get()).exists()) return;
  const rows = await metadataList(db, `sessions/${sessionId}/questions`, [...fields, ...REVEALED_FIELDS]);
  const view = Object.fromEntries(rows.map(({ id, ...row }) => {
    const value = Object.fromEntries(Object.entries(row).filter(([key, field]) => field != null && !REVEALED_FIELDS.includes(key)));
    if (value.revealedAt || value.answerRevealed === true) {
      for (const key of REVEALED_FIELDS) if (row[key] != null) value[key] = row[key];
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
