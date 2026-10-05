import { participantIsOnline } from './participants';
import { isResponseQuestion } from './response-questions';

/** 학습 능력을 추정하지 않고 실제 답변한 문항 수만으로 작은 칭찬을 고른다. */
export function participationLeader(questions, participants) {
  const counts = new Map();
  const online = new Set(Object.keys(participants || {}).filter(id => participantIsOnline(participants[id])));
  for (const question of Object.values(questions || {})) {
    if (!isResponseQuestion(question)) continue;
    for (const [id, vote] of Object.entries(question.votes || {})) {
      if (!online.has(id) || vote?.value == null) continue;
      const previous = counts.get(id) || { count: 0, latest: 0 };
      counts.set(id, { count: previous.count + 1, latest: Math.max(previous.latest, Number(vote.timestamp) || 0) });
    }
  }
  let first = null;
  for (const entry of counts) {
    if (entry[1].count < 3) continue;
    if (!first || entry[1].count > first[1].count || (entry[1].count === first[1].count && (entry[1].latest > first[1].latest || (entry[1].latest === first[1].latest && entry[0].localeCompare(first[0]) < 0)))) first = entry;
  }
  if (!first) return null;
  const [id, value] = first;
  return { id, name: participants[id].nickname || '학습자', count: value.count, milestone: Math.floor(value.count / 3) * 3 };
}
