/**
 * 내용 적응형 글자 크기 — 질문 제목 길이, 보기 개수, 가장 긴 보기, 전체 글자 수로
 * 화면 밀도(spacious / normal / compact / dense)를 정한다.
 * CSS 가 data-density 값에 따라 --stage-* / 학생 제목 크기를 비율로 줄인다(src/styles/index.css).
 */
export const DENSITY_LEVELS = ['spacious', 'normal', 'compact', 'dense'];

const LEVEL_INDEX = Object.fromEntries(DENSITY_LEVELS.map((level, index) => [level, index]));
const len = value => (typeof value === 'string' || typeof value === 'number' ? String(value).trim().length : 0);

// 보기가 없는 화면(워드클라우드·Q&A 등)은 제목 아래 공간이 넉넉하므로 제목만으로 dense 까지 내리지 않는다.
function titleLevel(titleLength, hasOptions) {
  if (titleLength <= 22) return 0;
  if (titleLength <= 44) return 1;
  if (titleLength <= 72) return 2;
  return hasOptions ? 3 : 2;
}

function optionLevel(count, longest) {
  let level = 0;
  if (count >= 7 || longest > 48) level = 3;
  else if (count >= 5 || longest > 28) level = 2;
  else if (count >= 3 || longest > 14) level = 1;
  // 보기가 많으면서 길면 한 단계 더 줄인다.
  if (count >= 4 && longest > 28) level = Math.max(level, 3);
  return level;
}

function totalLevel(total) {
  if (total > 260) return 3;
  if (total > 170) return 2;
  return 0;
}

/**
 * @param {{ title?: string, options?: Array<string|number>, extra?: string }} content
 * @returns {{ level: 'spacious'|'normal'|'compact'|'dense', titleLength: number, optionCount: number, longestOption: number, totalLength: number }}
 */
export function getTextDensity({ title = '', options = [], extra = '' } = {}) {
  const list = Array.isArray(options) ? options : [];
  const titleLength = len(title);
  const longestOption = list.reduce((max, option) => Math.max(max, len(option)), 0);
  const totalLength = titleLength + list.reduce((sum, option) => sum + len(option), 0) + len(extra);
  const level = Math.max(titleLevel(titleLength, list.length > 0), optionLevel(list.length, longestOption), totalLevel(totalLength));
  return { level: DENSITY_LEVELS[level], titleLength, optionCount: list.length, longestOption, totalLength };
}

/** 질문 객체에서 밀도를 구한다. 미스터리/힌트처럼 본문 역할을 하는 필드도 반영한다. */
export function getQuestionDensity(question) {
  if (!question) return getTextDensity();
  const options = question.type === 'mysteryBox' ? question.mysteryItems : question.options;
  const extra = question.type === 'hintQuiz' && Array.isArray(question.hints) ? question.hints.join('') : '';
  return getTextDensity({ title: question.title, options, extra });
}

/** 여러 밀도 중 더 빽빽한 쪽 */
export const denserOf = (a, b) => (LEVEL_INDEX[a] >= LEVEL_INDEX[b] ? a : b);
