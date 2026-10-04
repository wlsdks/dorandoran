import { participantIsOnline } from './participants';

const INTERACTIVE = new Set(['choice','ox','quiz','wordcloud','qna','scale','debate','ranking','fillinblank','check','mysteryBox','hintQuiz','shortAnswer','subjective']);

/** 학습 능력을 추정하지 않고 실제 답변한 문항 수만으로 작은 칭찬을 고른다. */
export function participationLeader(questions, participants) {
  const counts = new Map();
  for (const question of Object.values(questions || {})) {
    if (!INTERACTIVE.has(question.type)) continue;
    for (const [id, vote] of Object.entries(question.votes || {})) {
      if (!participantIsOnline(participants?.[id]) || vote?.value == null) continue;
      const previous = counts.get(id) || { count: 0, latest: 0 };
      counts.set(id, { count: previous.count + 1, latest: Math.max(previous.latest, Number(vote.timestamp) || 0) });
    }
  }
  const [first] = [...counts].filter(([, value]) => value.count >= 3).sort((a, b) => b[1].count - a[1].count || b[1].latest - a[1].latest || a[0].localeCompare(b[0]));
  if (!first) return null;
  const [id, value] = first;
  return { id, name: participants[id].nickname || '학습자', count: value.count, milestone: Math.floor(value.count / 3) * 3 };
}
