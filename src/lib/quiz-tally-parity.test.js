import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { quizDistribution } from './quiz-distribution';
import { summarizeVotes } from './classroom-data';

const require = createRequire(import.meta.url);
const { tallyQuizVotes, instructorFresh, createQuizTallyFallback, INSTRUCTOR_STALE_MS } = require('../../functions/quiz-tally.js');

// 강사 화면(useVotes → quizDistribution)과 같은 계산 경로
function clientTally(options, votes, round) {
  const { tallied } = summarizeVotes(votes);
  return quizDistribution(options, value => tallied[value] || 0, round);
}

const FIXTURES = [
  { name: '보통', options: ['A', 'B', 'C'], votes: { a: { value: 'A' }, b: { value: 'B' }, c: { value: 'A' } } },
  { name: '응답 없음', options: ['3', '4'], votes: null },
  { name: '보기에 없는 값·깨진 항목', options: ['가', '나'], votes: { a: { value: '다' }, b: null, c: 'x', d: { value: '가' } } },
  { name: '같은 보기 글자 중복', options: ['O', 'O', 'X'], votes: { a: { value: 'O' }, b: { value: 'X' } } },
  { name: '사진 보기 자동 이름 90명', options: ['사진 A', '사진 B'], votes: Object.fromEntries(Array.from({ length: 90 }, (_, i) => [`s${i}`, { value: i % 3 ? '사진 A' : '사진 B', nickname: `학생${i}` }])) },
];

describe('서버 예비 집계는 강사 화면 집계와 같다', () => {
  for (const fixture of FIXTURES) {
    it(fixture.name, () => {
      expect(tallyQuizVotes(fixture.options, fixture.votes, 123)).toEqual(clientTally(fixture.options, fixture.votes, 123));
    });
  }
  it('개인 응답·닉네임·정답은 담지 않는다', () => {
    const tally = tallyQuizVotes(['A', 'B'], { s1: { value: 'A', nickname: '민지' } }, 5);
    expect(Object.keys(tally).sort()).toEqual(['counts', 'round', 'total']);
  });
});

/** 경로 기반 메모리 DB — get/child/transaction만 흉내 낸다(Admin SDK처럼 첫 호출은 캐시 없이 null). */
function fakeDb(initial) {
  const data = structuredClone(initial);
  const reads = [];
  const at = path => path.split('/').filter(Boolean).reduce((node, key) => (node == null ? undefined : node[key]), data);
  const put = (path, value) => {
    const keys = path.split('/').filter(Boolean);
    const last = keys.pop();
    const parent = keys.reduce((node, key) => (node[key] ??= {}), data);
    if (value === undefined || value === null) delete parent[last]; else parent[last] = value;
  };
  const ref = path => ({
    child: sub => ref(`${path}/${sub}`),
    get: async () => { reads.push(path); const v = at(path); return { val: () => (v === undefined ? null : structuredClone(v)) }; },
    transaction: async update => {
      update(null);
      const result = update(at(path) === undefined ? null : structuredClone(at(path)));
      if (result !== undefined) put(path, result);
      return { committed: result !== undefined };
    },
  });
  return { ref, data, reads };
}

const NOW = 1_000_000;
function classroom({ heartbeat, source, mode = 'quiz', current = 'q1', type = 'quiz', aggregate } = {}) {
  const fallbackAggregate = heartbeat == null ? undefined : { round: 777, total: 1, counts: [1, 0], heartbeat, ...(source ? { source } : {}) };
  return {
    sessions: { s1: {
      currentQuestion: current, currentMode: mode,
      questions: { q1: { type, activatedAt: 777, options: ['A', 'B'], votes: { a: { value: 'A' }, b: { value: 'B' }, c: { value: 'A' } } } },
      publicQuizAggregates: { q1: aggregate ?? fallbackAggregate },
    } },
  };
}

describe('서버 예비 집계 판단', () => {
  const run = async state => {
    const db = fakeDb(state);
    const reason = await createQuizTallyFallback({ db, now: () => NOW, logger: {} })({ sid: 's1', qId: 'q1' });
    return { reason, db, aggregate: db.data.sessions.s1.publicQuizAggregates?.q1 };
  };
  it('강사 신호가 살아 있으면 작은 값 3개만 읽고 끝낸다', async () => {
    const { reason, db, aggregate } = await run(classroom({ heartbeat: NOW - 1000 }));
    expect(reason).toBe('instructor-fresh');
    expect(db.reads).toHaveLength(3);
    expect(aggregate.total).toBe(1);
  });
  it('퀴즈가 아니거나 지금 문항이 아니거나 집계를 안 보는 화면이면 손대지 않는다', async () => {
    expect((await run(classroom({ type: 'choice' }))).reason).toBe('not-quiz');
    expect((await run(classroom({ current: 'q9' }))).reason).toBe('not-current');
    expect((await run(classroom({ mode: 'leaderboard', heartbeat: NOW - 60000 }))).reason).toBe('not-shown');
  });
  it('강사 신호가 끊기면 투표 원본으로 다시 세고 강사 신호는 그대로 둔다', async () => {
    const stale = NOW - INSTRUCTOR_STALE_MS - 1;
    const { reason, aggregate } = await run(classroom({ heartbeat: stale }));
    expect(reason).toBe('written');
    expect(aggregate).toEqual({ round: 777, total: 3, counts: [2, 1], source: 'server', serverAt: NOW, heartbeat: stale });
  });
  it('집계가 아직 없으면 서버가 먼저 채우고 강사 신호는 만들지 않는다', async () => {
    const { reason, aggregate } = await run(classroom());
    expect(reason).toBe('written');
    expect(aggregate.heartbeat).toBeUndefined();
    expect(aggregate.total).toBe(3);
  });
  it('더 늦게 센 서버 결과를 덮지 않는다', async () => {
    const { reason, aggregate } = await run(classroom({ aggregate: { round: 777, total: 9, counts: [9, 0], source: 'server', serverAt: NOW + 5 } }));
    expect(reason).toBe('newer-server');
    expect(aggregate.total).toBe(9);
  });
  it('지난 회차 서버 결과는 새 회차로 덮는다', async () => {
    const { reason, aggregate } = await run(classroom({ aggregate: { round: 1, total: 9, counts: [9, 0], source: 'server', serverAt: NOW + 5 } }));
    expect(reason).toBe('written');
    expect(aggregate.round).toBe(777);
  });
  it('서버가 쓴 집계는 강사 신호로 치지 않는다', () => {
    expect(instructorFresh({ heartbeat: NOW, source: 'server' }, NOW)).toBe(false);
    expect(instructorFresh({ heartbeat: NOW }, NOW)).toBe(true);
    expect(instructorFresh({ heartbeat: NOW - INSTRUCTOR_STALE_MS - 1 }, NOW)).toBe(false);
  });
});
