import { buildQuestionData, QUESTION_TYPE_FIELDS } from './question';

/**
 * 수업에서 이미 쓴 문항의 수정 규칙. 학생 응답·점수를 조용히 망가뜨리는 수정은 막는다.
 * - 정답 공개 후: 정답(허용 답 포함)은 바꿀 수 없다.
 * - 응답이 있으면: 유형 변경 불가, 응답 받은 보기는 이름 변경·삭제 불가(새 보기 추가는 가능),
 *   순위 맞추기는 항목·순서 변경 불가(투표가 항목 번호로 저장된다).
 * 응답 초기화 후에는 모두 다시 바꿀 수 있다.
 */
export const EDIT_LOCK_MESSAGES = {
  answer: '정답 공개 후에는 정답을 바꿀 수 없어요. 응답 초기화 후 바꿀 수 있어요.',
  options: '응답이 있는 보기는 이름을 바꾸거나 지울 수 없어요. 응답 초기화 후 바꿀 수 있어요.',
  ranking: '응답이 있으면 순위 항목과 순서를 바꿀 수 없어요. 응답 초기화 후 바꿀 수 있어요.',
  type: '응답이 있는 문항은 유형을 바꿀 수 없어요. 응답 초기화 후 바꿀 수 있어요.',
};

const ANSWER_TYPES = ['quiz', 'ox', 'fillinblank', 'shortAnswer', 'mysteryBox', 'hintQuiz', 'ranking'];
const CHOICE_TYPES = ['choice', 'quiz'];

const isRevealed = (q) => (q?.revealedAt !== null && q?.revealedAt !== undefined) || q?.answerRevealed === true;
const voteValues = (q) => Object.values(q?.votes || {}).map((v) => v?.value).filter((v) => v !== null && v !== undefined);
const sameList = (a = [], b = []) => a.length === b.length && a.every((v, i) => v === b[i]);
const cleanList = (list) => (Array.isArray(list) ? list.map((v) => String(v).trim()).filter(Boolean) : []);

/** 기존 문항(수업 데이터)으로부터 수정 폼이 잠글 부분을 계산한다. 보관함 문항처럼 응답이 없으면 아무것도 잠기지 않는다. */
export function questionEditLocks(existing) {
  const values = voteValues(existing);
  const hasVotes = values.length > 0;
  const type = existing?.type;
  const hasCorrect = ANSWER_TYPES.includes(type) || (type === 'choice' && !!existing?.correctAnswer);
  const options = existing?.options || [];
  return {
    hasVotes,
    answerLocked: isRevealed(existing) && hasCorrect,
    typeLocked: hasVotes,
    lockedOptions: CHOICE_TYPES.includes(type) ? [...new Set(values.map(String))].filter((v) => options.includes(v)) : [],
    rankingLocked: type === 'ranking' && hasVotes,
  };
}

/** 저장 전에 잠긴 부분을 바꿨는지 확인한다. 문제가 없으면 null, 있으면 강사에게 보여줄 문구. */
export function validateQuestionEdit(existing, fields) {
  if (!existing) return null;
  const locks = questionEditLocks(existing);
  if (locks.typeLocked && fields.type !== existing.type) return EDIT_LOCK_MESSAGES.type;
  if (locks.rankingLocked && !sameList(cleanList(fields.options), existing.options || [])) return EDIT_LOCK_MESSAGES.ranking;
  if (locks.lockedOptions.length) {
    const next = cleanList(fields.options);
    if (locks.lockedOptions.some((option) => !next.includes(option))) return EDIT_LOCK_MESSAGES.options;
  }
  if (locks.answerLocked && existing.type === 'ranking' && !sameList(cleanList(fields.options), existing.options || [])) return EDIT_LOCK_MESSAGES.ranking;
  if (locks.answerLocked && existing.type !== 'ranking') {
    const nextAnswer = typeof fields.correctAnswer === 'string' ? fields.correctAnswer.trim() : fields.correctAnswer;
    if ((nextAnswer || '') !== (existing.correctAnswer || '')) return EDIT_LOCK_MESSAGES.answer;
    if (!sameList(cleanList(fields.acceptableAnswers), cleanList(existing.acceptableAnswers))) return EDIT_LOCK_MESSAGES.answer;
  }
  return null;
}

/**
 * 문항 수정 패치. 투표·공개 기록은 건드리지 않고 바뀌는 필드만 쓴다(set으로 전체를 쓰면 공개 후 규칙에 막힌다).
 * 진행 상태(공개된 힌트 수 등)는 같은 유형이면 그대로 둔다.
 */
export function buildQuestionEditPatch(existing, fields) {
  const next = buildQuestionData(fields.type, fields);
  const patch = { type: fields.type, title: fields.title.trim() };
  QUESTION_TYPE_FIELDS.forEach((k) => { patch[k] = next[k] === undefined ? null : next[k]; });
  Object.entries(next).forEach(([k, v]) => { if (!(k in patch)) patch[k] = v; });
  if (existing?.type === fields.type && fields.type === 'hintQuiz' && Number(existing.revealedHints) > 0) {
    patch.revealedHints = Math.min(Number(existing.revealedHints), (patch.hints || []).length);
  }
  return patch;
}
