import { get, ref, runTransaction } from 'firebase/database';
import { getQuizReward, isQuizQuestion } from './quiz';

// 모든 강사 화면의 수동 공개/스피드 퀴즈가 같은 진행 잠금을 공유한다.
export const quizAwardLocks = new Map();
export async function waitForQuizAwards(sessionId) {
  const pending = quizAwardLocks.get(sessionId);
  if (pending) await pending;
}
const record = value => value && typeof value === 'object' ? value : {};
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const hasAward = question => question?.awardedAt !== null && question?.awardedAt !== undefined;
export function quizComboMultiplier(streak) {
  return streak >= 5 ? 1.5 : streak >= 3 ? 1.2 : 1;
}
export function scoreNickname(value, fallback = '참여자') {
  const raw = typeof value === 'string' && value.trim() ? value.trim() : fallback;
  let result = '';
  for (const character of raw) {
    if (result.length + character.length > 10) break;
    result += character;
  }
  return result || '참여자';
}
export function hasQuizRoundReceipt(score, questionId, round) {
  const receipts = record(score?.quizAwards);
  return Object.hasOwn(receipts, questionId) && receipts[questionId]?.round === round;
}

/** Pure transaction callback: score + streak + receipt always move together. */
export function applyQuizScoreAwards(current, question, questionId, round, participants = {}, speedQuiz = false) {
  const next = { ...record(current) };
  for (const [participantId, vote] of Object.entries(record(question?.votes))) {
    const previous = record(Object.hasOwn(next, participantId) ? next[participantId] : null);
    if (hasQuizRoundReceipt(previous, questionId, round)) continue;
    const reward = getQuizReward(question, vote);
    const streak = reward.isCorrect ? Math.max(0, number(previous.streak)) + 1 : 0;
    const points = Math.round(reward.points * (speedQuiz ? quizComboMultiplier(streak) : 1));
    const nickname = participants[participantId]?.nickname || vote?.nickname || previous.nickname || `참여자 ${participantId.slice(0, 4)}`;
    const score = { ...previous, total: number(previous.total) + points,
      nickname: scoreNickname(nickname), lastPoints: points, streak,
      bestStreak: Math.max(number(previous.bestStreak), streak), lastQuestionId: questionId, updatedAt: round,
      // 질문마다 최신 round 하나만 보관한다. 과거 질문/점수/참여자 데이터는 지우지 않는다.
      quizAwards: { ...record(previous.quizAwards), [questionId]: { round, points } },
    };
    // 레거시 ID가 __proto__ 같은 이름이어도 객체 prototype을 변경하지 않는다.
    Object.defineProperty(next, participantId, { value: score, enumerable: true, configurable: true, writable: true });
  }
  return next;
}

/**
 * 응답 초기화 시 이 문항으로 받은 점수를 되돌리는 multi-path 업데이트(세션 기준 상대 경로).
 * 영수증(quizAwards[questionId])이 있는 참여자만 total에서 그 점수를 빼고 영수증을 지운다.
 * 다시 풀고 공개하면 새 영수증으로 한 번만 지급된다(이중 지급 방지). 연속 정답 기록은 되돌리지 않는다.
 */
export function quizAwardRollbackUpdates(scores, questionId) {
  const updates = {};
  for (const [participantId, score] of Object.entries(record(scores))) {
    const receipts = record(score?.quizAwards);
    if (!Object.hasOwn(receipts, questionId)) continue;
    const points = number(receipts[questionId]?.points);
    updates[`scores/${participantId}/total`] = number(score?.total) - points;
    updates[`scores/${participantId}/quizAwards/${questionId}`] = null;
    if (score?.lastQuestionId === questionId) updates[`scores/${participantId}/lastPoints`] = 0;
  }
  return updates;
}

function checkRound(question, round) {
  if (!isQuizQuestion(question) || question.revealedAt !== round) throw new Error('QUIZ_ROUND_CHANGED');
}
async function performAward(database, sessionId, questionId, now) {
  const base = `sessions/${sessionId}`;
  const questionRef = ref(database, `${base}/questions/${questionId}`);
  const initial = (await get(questionRef)).val();
  if (!isQuizQuestion(initial)) return { status: 'not-quiz' };
  // 기존 레거시 지급 표시가 있는 문항은 재지급하지 않는다.
  if (hasAward(initial)) return { status: 'already-awarded', round: initial.revealedAt };
  const reveal = await runTransaction(ref(database, `${base}/questions/${questionId}/revealedAt`),
    current => Number.isFinite(current) && current > 0 ? current : Math.max(1, Math.trunc(now)), { applyLocally: false });
  const round = reveal.snapshot.val();
  if (!Number.isFinite(round) || round <= 0) throw new Error('QUIZ_REVEAL_FAILED');
  let question = (await get(questionRef)).val();
  checkRound(question, round);
  const [people, speed] = await Promise.all([
    get(ref(database, `${base}/participants`)), get(ref(database, `${base}/speedQuiz/active`)),
  ]);
  // 공개 이후에는 학생의 새 투표가 rules에서 막힌다. 네트워크 재연결/캐시 fallback 후에도
  // 마지막 서버 확인에서 새로 발견한 투표는 receipt 기반으로 안전하게 추가 반영한다.
  for (let attempt = 0; attempt < 4; attempt++) {
    if (hasAward(question)) return { status: 'already-awarded', round };
    const result = await runTransaction(ref(database, `${base}/scores`),
      current => applyQuizScoreAwards(current, question, questionId, round, people.val() || {}, (Number.isFinite(question.speedQuizRound) && question.speedQuizRound > 0 && question.speedQuizRound === question.activatedAt || speed.val() === true)),
      { applyLocally: false });
    if (!result.committed) throw new Error('QUIZ_SCORE_FAILED');
    const latest = (await get(questionRef)).val();
    checkRound(latest, round);
    if (hasAward(latest)) return { status: 'already-awarded', round };
    const awarded = result.snapshot.val() || {};
    const complete = Object.keys(record(latest.votes)).every(id => hasQuizRoundReceipt(awarded[id], questionId, round));
    if (!complete) { question = latest; continue; }
    // 실패/브라우저 종료가 여기서 발생해도 점수+receipt는 이미 atomic하게 커밋됐다.
    // 재시도는 점수를 건드리지 않고 완료 표시만 다시 기록한다.
    const marked = await runTransaction(ref(database, `${base}/questions/${questionId}/awardedAt`),
      current => current === null ? round : current, { applyLocally: false });
    if (!marked.committed || marked.snapshot.val() === null) throw new Error('QUIZ_COMPLETION_FAILED');
    return { status: 'awarded', round, count: Object.keys(record(latest.votes)).length };
  }
  throw new Error('QUIZ_VOTES_NOT_SETTLED');
}

export async function awardQuizRound(database, sessionId, questionId, now = Date.now()) {
  const previous = quizAwardLocks.get(sessionId) || Promise.resolve();
  const work = previous.then(() => performAward(database, sessionId, questionId, now));
  // 진행 잠금은 항상 해제된다. 점수 반영 실패가 다음 질문/종료를 막지 않는다.
  const settled = work.then(() => undefined, () => undefined);
  quizAwardLocks.set(sessionId, settled);
  try { return await work; }
  finally { if (quizAwardLocks.get(sessionId) === settled) quizAwardLocks.delete(sessionId); }
}
