const fields = require('./public-question-fields.json');
const { metadataList } = require('./metadata');

async function ensureQuestionView(db, sessionId) {
  const target = db.ref(`sessions/${sessionId}/publicQuestions`);
  if ((await target.get()).exists()) return;
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
  await target.set(view);
}
module.exports = { ensureQuestionView };
