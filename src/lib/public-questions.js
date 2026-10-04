import fields from '../../functions/public-question-fields.json';
import { EMPTY_RECORD } from './realtime';

/** 공개 질문에서 원본 투표·제출물·미공개 정답을 제외한다. 원본 노드는 그대로 유지한다. */
export function publicQuestions(questions) {
  return Object.fromEntries(Object.entries(questions || EMPTY_RECORD).map(([id, question]) => {
    const value = Object.fromEntries(fields.filter(key => question[key] !== undefined && question[key] !== null).map(key => [key, question[key]]));
    if (question.revealedAt || question.answerRevealed === true) {
      if (question.correctAnswer != null) value.correctAnswer = question.correctAnswer;
      if (question.acceptableAnswers != null) value.acceptableAnswers = question.acceptableAnswers;
    }
    if (Array.isArray(value.hints)) value.hints = value.hints.slice(0, Number(question.revealedHints) || 0);
    return [id, value];
  }));
}

/** 슬라이드 번호 하나가 바뀔 때 전체 문항/이미지 목록을 다시 전송하지 않는다. */
export function publicQuestionUpdates(previous, next) {
  const updates = {};
  for (const id of new Set([...Object.keys(previous || {}), ...Object.keys(next)])) {
    if (!next[id]) { updates[id] = null; continue; }
    if (!previous?.[id]) { updates[id] = next[id]; continue; }
    for (const key of new Set([...Object.keys(previous[id]), ...Object.keys(next[id])])) {
      if (JSON.stringify(previous[id][key]) !== JSON.stringify(next[id][key])) updates[`${id}/${key}`] = next[id][key] ?? null;
    }
  }
  return updates;
}
