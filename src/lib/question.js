import { QUIZ_DEFAULTS } from './quiz';

/**
 * 질문 폼 입력에서 type별 questionData 필드를 순수 계산한다.
 * 생성(handleSubmit)·수정(updateQuestion) 양쪽이 공유 — 단일 출처로 한쪽만 고쳐 어긋나던 회귀 방지.
 * base 필드(type/title/order, 수정 시 기존 객체 병합)는 호출부가 담당한다.
 *
 * @param {string} type 질문 유형
 * @param {object} fields 폼 입력 { options, correctAnswer, points, event, betting, hints, mysteryItems, answerReasons, acceptableAnswers, winners, imageUrl, answerImageUrl, answerExplanation, slideImages, hideTitle, modelAnswer, embedUrl }
 * @returns {object} type별로 채워진 필드 객체
 */
export function buildQuestionData(type, fields = {}) {
  const {
    options: cleanOptions = [], correctAnswer, points, event, betting,
    hints, mysteryItems, answerReasons, acceptableAnswers, winners,
    imageUrl, answerImageUrl, answerExplanation, slideImages, hideTitle, modelAnswer, embedUrl, optionImages,
  } = fields;
  const data = {};

  const isChoiceLike = type === 'choice' || type === 'quiz';
  if (isChoiceLike) {
    data.options = cleanOptions;
    // 보기 이미지는 options와 같은 순서로 맞춘 배열. 하나도 없으면 저장하지 않는다.
    const images = cleanOptions.map((_, i) => (typeof optionImages?.[i] === 'string' ? optionImages[i] : ''));
    if (images.some(Boolean)) data.optionImages = images;
    if (type === 'quiz') data.correctAnswer = cleanOptions.includes(correctAnswer) ? correctAnswer : cleanOptions[0];
    else if (cleanOptions.includes(correctAnswer)) data.correctAnswer = correctAnswer;
  }
  if (type === 'ranking') {
    data.options = cleanOptions;
    data.correctAnswer = cleanOptions.map((_, i) => String(i)).join(',');
  }
  if (type === 'fillinblank') {
    data.correctAnswer = correctAnswer?.trim() || '';
  }
  if (type === 'shortAnswer') {
    data.correctAnswer = correctAnswer?.trim() || '';
    if (acceptableAnswers?.length > 0) data.acceptableAnswers = acceptableAnswers;
  }
  if (type === 'ox') {
    data.correctAnswer = correctAnswer || 'O';
  }
  if (type === 'mysteryBox') {
    data.correctAnswer = correctAnswer?.trim() || '';
    if (mysteryItems?.length > 0) data.mysteryItems = mysteryItems;
    if (answerReasons?.length > 0) data.answerReasons = answerReasons;
    if (winners?.length > 0) data.winners = winners;
  }
  if (type === 'hintQuiz') {
    data.correctAnswer = correctAnswer?.trim() || '';
    data.hints = hints || [];
    data.revealedHints = 0;
    if (answerReasons?.length > 0) data.answerReasons = answerReasons;
    if (acceptableAnswers?.length > 0) data.acceptableAnswers = acceptableAnswers;
    if (winners?.length > 0) data.winners = winners;
  }
  if (type === 'quiz') {
    data.points = points || QUIZ_DEFAULTS.points;
    data.speedWindowMs = QUIZ_DEFAULTS.speedWindowMs;
    data.maxSpeedBonus = QUIZ_DEFAULTS.maxSpeedBonus;
    if (event) data.event = event;
    if (betting) data.betting = true;
  }
  if (type === 'subjective' && modelAnswer?.trim()) {
    data.modelAnswer = modelAnswer.trim();
  }
  if (imageUrl) data.imageUrl = imageUrl;
  // 정답 해설(글·이미지)은 공개할 정답이 있을 때만 의미가 있다.
  if (answerImageUrl && data.correctAnswer) data.answerImageUrl = answerImageUrl;
  if (answerExplanation?.trim() && data.correctAnswer) data.answerExplanation = answerExplanation.trim();
  if (hideTitle) data.hideTitle = true;
  if (type === 'imageSlide' && slideImages?.length > 0) data.slideImages = slideImages;
  if (type === 'webEmbed' && embedUrl) data.embedUrl = embedUrl;

  return data;
}

/**
 * 수정 시 새 type에 맞지 않는 기존 type별 필드를 제거할 때 쓰는 키 목록.
 * (base 필드 type/title/order/votes 등은 제외 — 답변·메타 보존)
 */
export const QUESTION_TYPE_FIELDS = [
  'speedWindowMs', 'maxSpeedBonus', 'event', 'betting', 'options', 'correctAnswer', 'points', 'hints', 'revealedHints',
  'mysteryItems', 'answerReasons', 'acceptableAnswers', 'winners', 'slideImages',
  'imageUrl', 'optionImages', 'answerImageUrl', 'answerExplanation', 'hideTitle', 'modelAnswer', 'embedUrl',
];
