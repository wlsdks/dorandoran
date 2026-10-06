/**
 * 퀴즈 응답 집계의 서버 예비 경로.
 *
 * 평소에는 강사 화면이 sessions/{sid}/publicQuizAggregates/{qId}에 숫자 집계를 올린다
 * (src/hooks/useQuizDistributionPublisher.js). 강사 노트북이 잠들거나 탭이 닫혀 신호(heartbeat)가
 * 끊긴 동안에만 이 함수가 투표 원본에서 다시 세어 같은 모양으로 올린다. 강사 화면이 돌아오면
 * 그쪽 set()이 노드를 통째로 덮어 다시 주 경로가 된다.
 *
 * 집계 규칙은 클라이언트 quizDistribution()과 같아야 한다 — src/lib/quiz-tally-parity.test.js가 확인한다.
 */

/** 강사 화면은 10초마다 신호를 보낸다. 15초 넘게 끊겨야 서버가 대신 센다(일시적 지연에 끼어들지 않게). */
const INSTRUCTOR_STALE_MS = 15000;
const MAX_RESPONSES = 200000;

/** 클라이언트 quizDistribution(options, countByValue, round)과 같은 결과. 개인 응답·정답은 담지 않는다. */
function tallyQuizVotes(options, votes, round = 0) {
  const tallied = Object.create(null);
  for (const data of Object.values(votes && typeof votes === 'object' ? votes : {})) {
    if (!data || typeof data !== 'object') continue;
    tallied[data.value] = (tallied[data.value] || 0) + 1;
  }
  const countOf = option => tallied[option] || 0;
  const counts = options.map(countOf);
  const total = [...new Set(options)].reduce((sum, option) => sum + countOf(option), 0);
  return { round, total: Math.min(total, MAX_RESPONSES), counts };
}

/** 강사 화면의 집계가 살아 있는지 — 서버가 쓴 집계는 강사 신호로 치지 않는다. */
function instructorFresh(aggregate, now) {
  return Boolean(aggregate) && aggregate.source !== 'server'
    && Number.isFinite(aggregate.heartbeat) && now - aggregate.heartbeat <= INSTRUCTOR_STALE_MS;
}

/**
 * 투표 한 건마다 불린다. 대부분은 첫 단계(작은 값 3개)에서 끝난다.
 * 반환값은 테스트와 로그용 사유 문자열.
 */
function createQuizTallyFallback({ db, now = () => Date.now(), logger = console }) {
  return async function handleVote({ sid, qId }) {
    const session = db.ref(`sessions/${sid}`);
    const aggregateRef = session.child(`publicQuizAggregates/${qId}`);
    // 1단계: 지금 진행 중인 퀴즈인지, 강사 화면이 살아 있는지만 본다.
    const [currentSnap, typeSnap, aggregateSnap] = await Promise.all([
      session.child('currentQuestion').get(),
      session.child(`questions/${qId}/type`).get(),
      aggregateRef.get(),
    ]);
    if (typeSnap.val() !== 'quiz') return 'not-quiz';
    if (currentSnap.val() !== qId) return 'not-current';
    if (instructorFresh(aggregateSnap.val(), now())) return 'instructor-fresh';

    // 2단계: 강사 신호가 끊겼다. 전자칠판이 실제로 이 집계를 보는 상태에서만 다시 센다.
    const [modeSnap, roundSnap, optionsSnap] = await Promise.all([
      session.child('currentMode').get(),
      session.child(`questions/${qId}/activatedAt`).get(),
      session.child(`questions/${qId}/options`).get(),
    ]);
    if (!['poll', 'quiz'].includes(modeSnap.val())) return 'not-shown';
    const options = Array.isArray(optionsSnap.val()) ? optionsSnap.val() : Object.values(optionsSnap.val() || {});
    if (!options.length) return 'no-options';
    const round = roundSnap.val() || 0;
    const readAt = now();
    const votes = (await session.child(`questions/${qId}/votes`).get()).val();
    const tally = tallyQuizVotes(options, votes, round);

    let reason = 'written';
    await aggregateRef.transaction(current => {
      reason = 'written';
      // 그사이 강사 화면이 돌아왔으면 그쪽이 주인이다.
      if (instructorFresh(current, now())) { reason = 'instructor-resumed'; return undefined; }
      // 같은 회차에서 더 늦게 센 서버 결과가 이미 있으면 덮지 않는다(동시에 여러 투표가 처리될 때 순서 보장).
      // 같은 밀리초에 센 결과끼리는 응답 수가 많은 쪽(더 늦은 상태)을 남긴다.
      if (current && current.source === 'server' && current.round === round
        && (Number(current.serverAt) > readAt || (Number(current.serverAt) === readAt && current.total > tally.total))) { reason = 'newer-server'; return undefined; }
      const next = { ...tally, source: 'server', serverAt: readAt };
      // 강사 신호는 그대로 둔다 — 서버가 신호를 새로 찍으면 다음 투표 때 "강사가 살아 있다"로 오해한다.
      if (current && Number.isFinite(current.heartbeat)) next.heartbeat = current.heartbeat;
      return next;
    }, undefined, false);
    if (reason === 'written') logger.info?.('quizTallyFallback wrote server tally', { sid, qId, total: tally.total });
    return reason;
  };
}

module.exports = { INSTRUCTOR_STALE_MS, tallyQuizVotes, instructorFresh, createQuizTallyFallback };
