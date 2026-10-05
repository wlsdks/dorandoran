import { isAnswerCorrect } from './quiz';

export function revealedQuestionEntries(questions = {}) {
  return Object.entries(questions).filter(([, question]) => question?.correctAnswer && question.revealedAt);
}

/** Keep the original correct-first, fewer-attempts tie break and positive-score filter. */
export function answerRanking(questions = {}, votesByQuestion = {}, { publishedOnly = true } = {}) {
  const entries = publishedOnly ? revealedQuestionEntries(questions) : Object.entries(questions).filter(([, question]) => question?.correctAnswer);
  const scores = Object.create(null);
  for (const [questionId, question] of entries) {
    for (const [participantId, vote] of Object.entries(votesByQuestion[questionId] || {})) {
      if (!scores[participantId]) scores[participantId] = { id: participantId, nickname: vote.nickname || `참여자 ${participantId.slice(0, 4)}`, correct: 0, answered: 0 };
      scores[participantId].answered++;
      if (isAnswerCorrect(question, vote.value)) scores[participantId].correct++;
    }
  }
  return {
    ranking: Object.values(scores).filter(entry => entry.correct > 0)
      .sort((a, b) => b.correct - a.correct || a.answered - b.answered).map((entry, index) => ({ ...entry, rank: index + 1 })),
    respondentCount: Object.keys(scores).length,
    totalQuestions: entries.length,
  };
}
