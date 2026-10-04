import { normalizeAnswer } from './utils';

export const QUIZ_DEFAULTS = {
  points: 100,
  maxSpeedBonus: 50,
  speedWindowMs: 30000,
};

export const QUIZ_EVENT_PRESETS = [
  {
    id: 'double-points',
    label: '2배 점수',
    description: '다음 퀴즈의 정답 점수가 2배로 적용됩니다.',
    pointMultiplier: 2,
  },

];

const QUIZ_EVENT_MAP = Object.fromEntries(
  QUIZ_EVENT_PRESETS.map((preset) => [preset.id, preset])
);

export function isQuizQuestion(question) {
  return question?.type === 'quiz';
}

// 자유 입력형(학생이 직접 타이핑) — 정답 매칭 시 대소문자·띄어쓰기를 무시한다.
// 객관식(choice/ox/quiz)은 선택지 정확 일치라 여기 포함하지 않는다.
const TEXT_ANSWER_TYPES = new Set(['fillinblank', 'mysteryBox', 'hintQuiz', 'shortAnswer']);

export function isTextAnswerType(type) {
  return TEXT_ANSWER_TYPES.has(type);
}

/**
 * 정답 여부 판정(공통). 자유 입력형은 normalizeAnswer로 대소문자·띄어쓰기 무시 + acceptableAnswers
 * 허용, 그 외(객관식/OX)는 선택지 정확 일치. correctAnswer가 없으면 채점 대상 아님 → false.
 * @param {object} question
 * @param {string} value 학생 답변
 * @returns {boolean}
 */
export function isAnswerCorrect(question, value) {
  if (!question?.correctAnswer) return false;
  if (isTextAnswerType(question.type)) {
    const n = normalizeAnswer(value);
    if (!n) return false;
    return [question.correctAnswer, ...(question.acceptableAnswers || [])]
      .some((a) => normalizeAnswer(a) === n);
  }
  return value === question.correctAnswer;
}

export function getQuestionMode(question) {
  if (isQuizQuestion(question)) return 'quiz';
  if (question?.type === 'check') return 'poll';
  return 'poll';
}

export function getQuizEventPreset(eventId) {
  return QUIZ_EVENT_MAP[eventId] || null;
}

export function normalizeQuizEvent(event) {
  if (!event) return null;
  if (typeof event === 'string') return getQuizEventPreset(event);

  const preset = event.id ? getQuizEventPreset(event.id) : null;
  return preset ? { ...preset, pointMultiplier: Number(event.pointMultiplier) > 1 ? Number(event.pointMultiplier) : preset.pointMultiplier } : null;
}

export function getQuizEventBadges(event) {
  const normalized = normalizeQuizEvent(event);
  if (!normalized) return [];

  const badges = [];

  if ((normalized.pointMultiplier || 1) > 1) {
    badges.push(`${normalized.pointMultiplier}배 점수`);
  }


  return badges;
}

/**
 * Bet multiplier options for point betting.
 * { multiplier, label, penalty (points lost on wrong answer) }
 */
export const BET_OPTIONS = [
  { multiplier: 1, label: '안전', penalty: 0 },
  { multiplier: 2, label: '자신', penalty: 30 },
  { multiplier: 3, label: '올인', penalty: 60 },
];

export function getQuizReward(question, vote) {
  const isCorrect = typeof question?.correctAnswer === 'string' && question.correctAnswer.length > 0 && vote?.value === question.correctAnswer;
  const event = normalizeQuizEvent(question?.event);

  // Betting multiplier (1x/2x/3x) — only active when question has betting enabled
  const betEnabled = question?.betting === true;
  const requestedBet = betEnabled ? Number(vote?.bet) : 1;
  const betOption = BET_OPTIONS.find((option) => option.multiplier === requestedBet) || BET_OPTIONS[0];
  const betMultiplier = betOption.multiplier;

  if (!isCorrect) {
    return {
      isCorrect: false,
      points: betEnabled ? -betOption.penalty : 0,
      bet: betMultiplier,
    };
  }

  const activatedAt = typeof question?.activatedAt === 'number' ? question.activatedAt : 0;
  const validTimestamp = Number.isFinite(vote?.timestamp) && vote.timestamp >= activatedAt;
  const submittedAt = validTimestamp ? vote.timestamp : activatedAt;
  const speedWindowMs = question?.speedWindowMs ?? QUIZ_DEFAULTS.speedWindowMs;
  const maxSpeedBonus = question?.maxSpeedBonus ?? QUIZ_DEFAULTS.maxSpeedBonus;
  const basePoints = question?.points ?? QUIZ_DEFAULTS.points;
  const pointMultiplier = event?.pointMultiplier ?? 1;
  const elapsedMs = Math.max(0, submittedAt - activatedAt);
  const speedRatio = validTimestamp ? Math.max(0, 1 - (elapsedMs / speedWindowMs)) : 0;
  const totalPoints = basePoints + Math.round(speedRatio * maxSpeedBonus);

  return {
    isCorrect: true,
    points: Math.round(totalPoints * pointMultiplier * betMultiplier),
    bet: betMultiplier,
  };
}
