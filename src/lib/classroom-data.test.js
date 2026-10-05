import { expect, it } from 'vitest';
import { summarizeVotes, summarizeParticipants, summarizeScores } from './classroom-data';
it('같은 스냅샷의 집계·정렬을 공유하고 새 회차 값은 분리한다', () => {
  const votes = { a: { value: 'A' }, b: { value: 'B' }, c: { value: 'A' } };
  const first = summarizeVotes(votes); expect(summarizeVotes(votes)).toBe(first);
  expect(first.totalVotes).toBe(3); expect(first.tallied).toMatchObject({ A: 2, B: 1 });
  const next = summarizeVotes({ a: { value: 'B' } }); expect(next).not.toBe(first); expect(next.tallied.A).toBeUndefined();
  expect(first.tallied.A).toBe(2);
});
it('프로토타입 이름을 답해도 집계가 오염되지 않는다', () => {
  const { tallied } = summarizeVotes({ a: { value: '__proto__' }, b: { value: 'constructor' } });
  expect(tallied.__proto__).toBe(1); expect(tallied.constructor).toBe(1); expect(Object.getPrototypeOf(tallied)).toBeNull();
});
it('명단의 접속 판정과 동점 순서를 공유하되 입력을 수정하지 않는다', () => {
  const people = { a: { nickname: 'A', connections: { one: true } }, b: { nickname: 'B', connections: {} } };
  const result = summarizeParticipants(people); expect(result.count).toBe(1); expect(result.onlineList[0].id).toBe('a');
  expect(summarizeParticipants(people)).toBe(result); expect(people.a.online).toBeUndefined();
  const scores = { a: { nickname: 'B', total: 5 }, b: { nickname: 'A', total: 5 } };
  const leaderboard = summarizeScores(scores); expect(leaderboard.map(p => p.id)).toEqual(['b', 'a']); expect(summarizeScores(scores)).toBe(leaderboard);
});
it('희소 배열의 null 자리와 잘못된 레거시 값은 유령 응답·참여자로 세지 않는다', () => {
  expect(summarizeVotes([null, { value: 'A' }, null]).totalVotes).toBe(1);
  expect(summarizeVotes('invalid').totalVotes).toBe(0);
  expect(summarizeParticipants([null, { nickname: 'A' }]).list).toHaveLength(1);
  expect(summarizeScores([null, { total: 1 }])).toHaveLength(1);
});
