// 점수 상승 순간 — 학생 본인 점수 레코드(sessions/{id}/scores/{pid})에서 '화면을 보는 동안 생긴 변화'만 골라낸다.
// 첫 스냅샷·재연결 직후·끊긴 동안의 변화는 기준선만 조용히 옮긴다. 순수 함수라 훅 없이 검증한다.
import { getQuizReward, normalizeQuizEvent, QUIZ_DEFAULTS } from './quiz';
import { quizComboMultiplier } from './quiz-awards';

export const GAIN_SHOW_MS = 1600;        // 전체 노출 시간(탭하면 즉시 닫힘)
export const GAIN_COUNT_MS = 900;        // 총점 카운트업
export const GAIN_COALESCE_MS = 600;     // 이 간격 안의 연속 증가는 한 장면으로 합친다
export const LOSS_SHOW_MS = 1200;        // 감점은 짧고 조용하게
export const RECONNECT_QUIET_MS = 1500;  // 재연결 직후 밀려온 변화는 안내하지 않는다
export const BIG_GAIN_POINTS = 150;
export const BIG_STREAK = 3;

export const INITIAL_GAIN_STATE = Object.freeze({ ready: false, baseline: 0, offline: false, quietUntil: 0 });

const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
export function scoreTotal(score) { return number(score?.total); }

/** `.info/connected` 전이. 끊기면 조용해지고, 복구되면 RECONNECT_QUIET_MS 동안 더 조용하다. */
export function trackConnection(state, connected, now = Date.now()) {
  if (connected === false) return state.offline ? state : { ...state, offline: true };
  if (state.offline) return { ...state, offline: false, quietUntil: now + RECONNECT_QUIET_MS };
  return state;
}

/**
 * 점수 스냅샷({ loading, error, value }) 관찰. 첫 실값은 기준선이 되고 이벤트를 내지 않는다.
 * 오류가 오면 기준선을 버린다(복구 뒤 첫 값이 새 기준선). 변화가 없으면 state를 그대로 돌려준다.
 */
export function observeScore(state, snapshot, now = Date.now()) {
  if (!snapshot || snapshot.loading) return { state, event: null };
  if (snapshot.error) return { state: state.ready ? { ...state, ready: false } : state, event: null };
  const total = scoreTotal(snapshot.value);
  if (state.ready && total === state.baseline) return { state, event: null };
  const next = { ...state, ready: true, baseline: total };
  if (!state.ready || state.offline || now < state.quietUntil) return { state: next, event: null };
  return { state: next, event: { delta: total - state.baseline, from: state.baseline, to: total, score: snapshot.value, at: now } };
}

/** 짧은 간격의 같은 방향 변화는 한 장면에 합친다 — 시작값은 유지, 합계·목표·영수증만 갱신. */
export function mergeGain(current, event, coalesceMs = GAIN_COALESCE_MS) {
  if (!current || event.at - current.at > coalesceMs || Math.sign(current.delta) !== Math.sign(event.delta)) {
    return { ...event, id: `${event.at}:${event.to}`, merged: false };
  }
  return { ...current, delta: current.delta + event.delta, to: event.to, score: event.score, at: event.at, merged: true };
}

/**
 * 두구두구(session.drumroll) 막이 내려와 있는 동안 도착한 변화는 들고 있다가 막이 걷힐 때 보여준다.
 * 강사 화면은 점수를 적립한 '뒤'에 drumroll을 지우므로, 안 들고 있으면 장면이 막 뒤에서 시작된다.
 */
export function holdGain(held, event) {
  if (!held) return { ...event };
  return { ...held, delta: held.delta + event.delta, to: event.to, score: event.score, at: event.at, merged: true };
}
export function releaseGain(held, now = Date.now()) {
  return held && held.delta !== 0 ? { ...held, at: now } : null;
}

export function isBigGain(delta, streak = 0) {
  return delta >= BIG_GAIN_POINTS || number(streak) >= BIG_STREAK;
}

/**
 * 학생이 읽을 수 있는 두 경로를 합친다 — 공개 문항(publicQuestions/{qid}: 공개 뒤에만 correctAnswer 포함)과
 * 내 투표(questions/{qid}/votes/{pid}). 원본 문항 전체·남의 투표는 읽지 않는다.
 */
export function withOwnVote(publicQuestion, participantId, vote) {
  if (!publicQuestion || typeof publicQuestion !== 'object') return null;
  return { ...publicQuestion, votes: vote && participantId ? { [participantId]: vote } : null };
}

/** 이번 변화가 어떤 문항의 수령증과 정확히 맞을 때만 그 문항과 내 투표를 돌려준다. */
function matchReceipt(scene, question, participantId) {
  const score = scene?.score;
  const questionId = score?.lastQuestionId;
  if (!scene || scene.merged || !question || !questionId) return null;
  const receipt = score.quizAwards?.[questionId];
  const points = number(receipt?.points ?? score.lastPoints);
  if (points !== scene.delta) return null;
  const vote = question.votes?.[participantId];
  return vote ? { vote, reward: getQuizReward(question, vote) } : null;
}

/** "정답 +100 · 속도 보너스 +47 · 베팅 ×2" — 분해가 합계와 맞지 않으면 null(숫자만 보여준다). */
export function describeGain(scene, question, participantId) {
  if (!(scene?.delta > 0)) return null;
  const match = matchReceipt(scene, question, participantId);
  if (!match?.reward.isCorrect) return null;
  const { vote, reward } = match;
  const base = number(question.points ?? QUIZ_DEFAULTS.points);
  const speedBonus = getQuizReward({ ...question, event: null, betting: false }, vote).points - base;
  const parts = [`정답 +${base}`];
  if (speedBonus > 0) parts.push(`속도 보너스 +${speedBonus}`);
  const eventMultiplier = normalizeQuizEvent(question.event)?.pointMultiplier ?? 1;
  if (eventMultiplier > 1) parts.push(`이벤트 ×${eventMultiplier}`);
  if (reward.bet > 1) parts.push(`베팅 ×${reward.bet}`);
  if (reward.points !== scene.delta) {
    const streak = number(scene.score.streak);
    const combo = quizComboMultiplier(streak);
    if (combo === 1 || Math.round(reward.points * combo) !== scene.delta) return null;
    parts.push(`${streak}연속 ×${combo}`);
  }
  return parts.join(' · ');
}

/** 감점 사유 — 베팅 오답 감점만 설명한다. 그 외는 null. */
export function describeLoss(scene, question, participantId) {
  if (!(scene?.delta < 0)) return null;
  const match = matchReceipt(scene, question, participantId);
  if (!match || match.reward.isCorrect || match.reward.points !== scene.delta) return null;
  return `오답 · 베팅 ×${match.reward.bet}`;
}

export function formatSigned(delta) {
  const value = Math.abs(Math.round(number(delta))).toLocaleString('ko-KR');
  return delta < 0 ? `−${value}` : `+${value}`;
}

/** 스크린리더 안내문. */
export function gainAnnouncement(scene) {
  if (!scene) return '';
  const total = Math.round(number(scene.to)).toLocaleString('ko-KR');
  const amount = Math.abs(Math.round(number(scene.delta))).toLocaleString('ko-KR');
  return scene.delta < 0 ? `${amount}점 감점. 총 ${total}점` : `${amount}점 획득. 총 ${total}점`;
}
