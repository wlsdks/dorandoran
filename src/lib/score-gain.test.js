import { describe, expect, it } from 'vitest';
import {
  INITIAL_GAIN_STATE, RECONNECT_QUIET_MS, GAIN_COALESCE_MS, observeScore, trackConnection, mergeGain,
  describeGain, describeLoss, withOwnVote, isBigGain, formatSigned, gainAnnouncement, holdGain, releaseGain,
} from './score-gain';

const loading = { loading: true, error: null, value: null };
const snap = (total, extra = {}) => ({ loading: false, error: null, value: total === null ? null : { total, ...extra } });
function warm(total = 100) { return observeScore(INITIAL_GAIN_STATE, snap(total), 1000).state; }

describe('라이브 증가만 안내한다', () => {
  it('로딩 중에는 아무것도 하지 않고, 첫 실값은 기준선이 될 뿐 안내하지 않는다', () => {
    expect(observeScore(INITIAL_GAIN_STATE, loading, 1)).toEqual({ state: INITIAL_GAIN_STATE, event: null });
    const first = observeScore(INITIAL_GAIN_STATE, snap(250), 1);
    expect(first.event).toBeNull(); expect(first.state).toMatchObject({ ready: true, baseline: 250 });
  });
  it('점수 레코드가 아직 없으면(null) 0점이 기준선이고, 첫 지급은 0에서 올라간 것으로 안내한다', () => {
    const state = observeScore(INITIAL_GAIN_STATE, snap(null), 1).state;
    const { event } = observeScore(state, snap(147, { streak: 1 }), 2);
    expect(event).toMatchObject({ delta: 147, from: 0, to: 147, at: 2 });
  });
  it('증가·감소를 delta 부호로 돌려주고, 같은 값은 state를 그대로 돌려준다', () => {
    const state = warm(100);
    expect(observeScore(state, snap(100), 2)).toEqual({ state, event: null });
    expect(observeScore(state, snap(240), 2).event).toMatchObject({ delta: 140, from: 100, to: 240 });
    expect(observeScore(state, snap(40), 2).event).toMatchObject({ delta: -60, from: 100, to: 40 });
  });
  it('끊긴 동안과 재연결 직후의 변화는 기준선만 옮긴다', () => {
    let state = trackConnection(warm(100), false, 1000);
    const offline = observeScore(state, snap(200), 1500);
    expect(offline.event).toBeNull(); expect(offline.state.baseline).toBe(200);
    state = trackConnection(offline.state, true, 2000);
    const justBack = observeScore(state, snap(300), 2000 + RECONNECT_QUIET_MS - 1);
    expect(justBack.event).toBeNull(); expect(justBack.state.baseline).toBe(300);
    expect(observeScore(justBack.state, snap(350), 2000 + RECONNECT_QUIET_MS).event).toMatchObject({ delta: 50 });
  });
  it('연결 상태가 아직 없거나(null) 그대로면 state 객체를 바꾸지 않는다', () => {
    const state = warm(100);
    expect(trackConnection(state, null, 1)).toBe(state);
    expect(trackConnection(state, true, 1)).toBe(state);
    const offline = trackConnection(state, false, 1);
    expect(trackConnection(offline, false, 2)).toBe(offline);
  });
  it('오류가 오면 기준선을 버리고, 복구 뒤 첫 값은 새 기준선이 된다', () => {
    const errored = observeScore(warm(100), { loading: false, error: new Error('x'), value: null }, 2).state;
    expect(errored.ready).toBe(false);
    expect(observeScore(errored, snap(900), 3).event).toBeNull();
  });
});

describe('연속 증가 합치기', () => {
  const event = (delta, at, to = 100 + delta) => ({ delta, from: 100, to, score: { total: to }, at });
  it('간격 안의 같은 방향 변화는 시작값을 유지한 채 합산한다', () => {
    const first = mergeGain(null, event(100, 1000));
    expect(first).toMatchObject({ id: '1000:200', merged: false });
    const merged = mergeGain(first, { ...event(47, 1000 + GAIN_COALESCE_MS, 247) });
    expect(merged).toMatchObject({ id: first.id, delta: 147, from: 100, to: 247, merged: true });
  });
  it('간격을 넘기거나 방향이 다르면 새 장면이 된다', () => {
    const first = mergeGain(null, event(100, 1000));
    expect(mergeGain(first, event(50, 1000 + GAIN_COALESCE_MS + 1)).merged).toBe(false);
    expect(mergeGain(first, event(-30, 1100, 170)).id).not.toBe(first.id);
  });
});

describe('두구두구 중 들고 있기', () => {
  const event = (delta, at, to) => ({ delta, from: 100, to, score: { total: to }, at });
  it('막이 내려온 동안의 변화는 간격과 상관없이 합치고, 걷힐 때 지금 시각으로 내보낸다', () => {
    const held = holdGain(holdGain(null, event(100, 1000, 200)), event(47, 9000, 247));
    expect(held).toMatchObject({ delta: 147, from: 100, to: 247, merged: true });
    expect(releaseGain(held, 12000)).toMatchObject({ delta: 147, at: 12000 });
  });
  it('합이 0이거나 아무것도 없으면 내보내지 않는다', () => {
    expect(releaseGain(null, 1)).toBeNull();
    expect(releaseGain(holdGain(holdGain(null, event(60, 1, 160)), event(-60, 2, 100)), 3)).toBeNull();
  });
});

describe('사유 설명', () => {
  const pid = 'p1';
  const quiz = { type: 'quiz', correctAnswer: 'B', options: ['A', 'B'], points: 100, maxSpeedBonus: 50, speedWindowMs: 30000, activatedAt: 10000, revealedAt: 20000 };
  const scene = (delta, score, extra = {}) => ({ delta, from: 0, to: delta, merged: false, score, ...extra });
  const award = (points, extra = {}) => ({ total: points, lastQuestionId: 'q1', lastPoints: points, quizAwards: { q1: { round: 20000, points } }, streak: 1, ...extra });
  it('정답과 속도 보너스를 나눠 적는다', () => {
    const question = { ...quiz, votes: { [pid]: { value: 'B', timestamp: 10000 + 1800 } } };
    expect(describeGain(scene(147, award(147)), question, pid)).toBe('정답 +100 · 속도 보너스 +47');
  });
  it('속도 보너스가 0이면 정답만, 이벤트·베팅 배수는 뒤에 붙인다', () => {
    const slow = { ...quiz, votes: { [pid]: { value: 'B', timestamp: 10000 + 30000 } } };
    expect(describeGain(scene(100, award(100)), slow, pid)).toBe('정답 +100');
    const boosted = { ...quiz, event: 'double-points', betting: true, votes: { [pid]: { value: 'B', bet: 2, timestamp: 10000 + 30000 } } };
    expect(describeGain(scene(400, award(400)), boosted, pid)).toBe('정답 +100 · 이벤트 ×2 · 베팅 ×2');
  });
  it('스피드 퀴즈 콤보 배수가 들어간 합계도 설명한다', () => {
    const question = { ...quiz, votes: { [pid]: { value: 'B', timestamp: 10000 + 30000 } } };
    expect(describeGain(scene(120, award(120, { streak: 3 })), question, pid)).toBe('정답 +100 · 3연속 ×1.2');
  });
  it('합산된 장면·수령증 불일치·내 투표 없음·오답은 숫자만 보여준다(null)', () => {
    const question = { ...quiz, votes: { [pid]: { value: 'B', timestamp: 10000 + 1800 } } };
    expect(describeGain(scene(147, award(147), { merged: true }), question, pid)).toBeNull();
    expect(describeGain(scene(150, award(147)), question, pid)).toBeNull();
    expect(describeGain(scene(147, award(147)), { ...quiz, votes: null }, pid)).toBeNull();
    expect(describeGain(scene(147, award(147)), null, pid)).toBeNull();
    expect(describeGain(scene(-60, award(-60)), question, pid)).toBeNull();
  });
  it('베팅 오답 감점만 사유를 적는다', () => {
    const betting = { ...quiz, betting: true, votes: { [pid]: { value: 'A', bet: 3, timestamp: 11000 } } };
    expect(describeLoss(scene(-60, award(-60)), betting, pid)).toBe('오답 · 베팅 ×3');
    expect(describeLoss(scene(-60, award(-60)), null, pid)).toBeNull();
    expect(describeLoss(scene(-10, award(-10)), betting, pid)).toBeNull();
  });
  it('공개 문항과 내 투표를 합치고, 정답이 아직 공개되지 않았으면 라벨을 만들지 않는다', () => {
    const composed = withOwnVote({ title: 't' }, 'p1', { value: 'B' });
    expect(composed.votes).toEqual({ p1: { value: 'B' } });
    expect(withOwnVote({ title: 't' }, 'p1', null).votes).toBeNull();
    expect(withOwnVote(null, 'p1', { value: 'B' })).toBeNull();
    const { correctAnswer: _hidden, ...unrevealed } = quiz;
    expect(describeGain(scene(147, award(147)), withOwnVote(unrevealed, pid, { value: 'B', timestamp: 11800 }), pid)).toBeNull();
    expect(describeGain(scene(147, award(147)), withOwnVote(quiz, pid, { value: 'B', timestamp: 11800 }), pid)).toBe('정답 +100 · 속도 보너스 +47');
  });
});

describe('표시 문자열', () => {
  it('큰 점수나 연속 정답이면 빛 번짐을 쓴다', () => {
    expect(isBigGain(150)).toBe(true); expect(isBigGain(100, 3)).toBe(true); expect(isBigGain(100, 2)).toBe(false);
  });
  it('부호와 천 단위, 안내문', () => {
    expect(formatSigned(1250)).toBe('+1,250'); expect(formatSigned(-60)).toBe('−60');
    expect(gainAnnouncement({ delta: 147, to: 1247 })).toBe('147점 획득. 총 1,247점');
    expect(gainAnnouncement({ delta: -60, to: 40 })).toBe('60점 감점. 총 40점');
    expect(gainAnnouncement(null)).toBe('');
  });
});
