import { isAnswerCorrect } from './quiz';

// Vote-backed activities only. Slides, mode cards and separate submissions have
// no vote action; counting them as unanswered would penalize attending learners.
const RESPONSE_TYPES = new Set([
  'choice', 'quiz', 'ox', 'wordcloud', 'qna', 'subjective', 'scale',
  'debate', 'ranking', 'fillinblank', 'shortAnswer', 'check',
  'mysteryBox', 'hintQuiz',
]);

export function questionParticipationKind(question) {
  if (RESPONSE_TYPES.has(question?.type)) return 'response';
  if (['imageSlide', 'webEmbed'].includes(question?.type)) return 'material';
  if (question?.type === 'aiJudge') return 'submission';
  if (question?.type === 'modeCard') return 'mode';
  return 'unknown';
}

export function isResponseQuestion(question) {
  return questionParticipationKind(question) === 'response';
}

export function responseQuestionEntries(questions) {
  // activatedAt is intentionally not a filter: old/imported lessons can lack
  // activation metadata. Absence alone cannot establish that an activity never ran.
  return Object.entries(questions || {}).filter(([, question]) => isResponseQuestion(question));
}

export function questionResponseState(question, participantId) {
  const participationKind = questionParticipationKind(question);
  const vote = participationKind === 'response' ? question?.votes?.[participantId] : null;
  const answered = Boolean(vote);
  const correctAnswer = participationKind === 'response' ? question?.correctAnswer || null : null;
  return {
    participationKind,
    answered,
    myAnswer: answered ? vote.value ?? null : null,
    correctAnswer,
    // Missing answers are not incorrect answers. Hidden/unconfigured answer keys
    // likewise cannot establish correctness.
    isCorrect: answered && correctAnswer ? isAnswerCorrect(question, vote.value) : null,
  };
}

export function summarizeParticipantResponses(questions, participantId) {
  let answeredCount = 0, correctCount = 0, gradableCount = 0;
  const entries = responseQuestionEntries(questions);
  for (const [, question] of entries) {
    const state = questionResponseState(question, participantId);
    if (state.answered) answeredCount++;
    if (state.isCorrect !== null) {
      gradableCount++;
      if (state.isCorrect) correctCount++;
    }
  }
  return { answeredCount, totalQuestions: entries.length, correctCount, gradableCount };
}
