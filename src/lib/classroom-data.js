import { participantIsOnline } from './participants';

const voteCache = new WeakMap(), peopleCache = new WeakMap(), scoreCache = new WeakMap();
/** 같은 불변 SDK 스냅샷을 쓰는 소비자는 변환·집계를 한 번만 수행한다. WeakMap은 이전 수업을 붙잡지 않는다. */
export function summarizeVotes(votes) {
  if (!voteCache.has(votes)) {
    const voteList = [], tallied = Object.create(null);
    for (const [id, data] of Object.entries(votes)) {
      voteList.push({ id, ...data });
      tallied[data.value] = (tallied[data.value] || 0) + 1;
    }
    voteCache.set(votes, { voteList, tallied, totalVotes: voteList.length });
  }
  return voteCache.get(votes);
}
export function summarizeParticipants(participants) {
  if (!peopleCache.has(participants)) {
    const list = Object.entries(participants).map(([id, data]) => ({ id, ...data, online: participantIsOnline(data) }));
    const onlineList = list.filter(person => person.online);
    peopleCache.set(participants, { list, onlineList, count: onlineList.length });
  }
  return peopleCache.get(participants);
}
export function summarizeScores(scores) {
  if (!scoreCache.has(scores)) scoreCache.set(scores, Object.entries(scores).map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => (b.total || 0) - (a.total || 0) || (a.nickname || '').localeCompare(b.nickname || '')));
  return scoreCache.get(scores);
}
