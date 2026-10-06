/**
 * 문항별 시간 제한 — 강사가 문항을 만들 때 정해 두면, 활성화할 때 세션 타이머가 그 길이로 자동 시작한다.
 * 저장 값은 초 단위 정수(timerDuration). 없으면 시간 제한 없음.
 */

/** 학생이 답하는 문항만 시간 제한을 둔다(자료·모드 카드·AI 심사 제출은 제외). */
export const TIMED_QUESTION_TYPES = new Set([
  'choice', 'quiz', 'ox', 'wordcloud', 'qna', 'subjective', 'scale', 'debate', 'ranking',
  'fillinblank', 'shortAnswer', 'check', 'mysteryBox', 'hintQuiz',
]);

export const TIME_LIMIT_PRESETS = [15, 30, 60];
export const TIME_LIMIT_MIN = 5;
export const TIME_LIMIT_MAX = 3600;

/** 입력값을 저장 가능한 초로 바꾼다. 범위를 벗어나거나 숫자가 아니면 null(제한 없음). */
export function normalizeTimeLimit(value) {
  if (value === '' || value === null || value === undefined) return null;
  const seconds = Math.round(Number(value));
  if (!Number.isFinite(seconds) || seconds < TIME_LIMIT_MIN || seconds > TIME_LIMIT_MAX) return null;
  return seconds;
}

export function supportsTimeLimit(type) {
  return TIMED_QUESTION_TYPES.has(type);
}

/** 활성화할 때 쓸 세션 타이머 값. 시간 제한이 없는 문항이면 null(타이머 끔). */
export function timerForQuestion(question, serverNow) {
  const seconds = supportsTimeLimit(question?.type) ? normalizeTimeLimit(question?.timerDuration) : null;
  if (!seconds) return null;
  return { endTime: serverNow + seconds * 1000, duration: seconds, running: true };
}

/** 15초 → "15초", 90초 → "1분 30초" */
export function formatTimeLimit(seconds) {
  const s = normalizeTimeLimit(seconds);
  if (!s) return '제한 없음';
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (!m) return `${r}초`;
  return r ? `${m}분 ${r}초` : `${m}분`;
}
