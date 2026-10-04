import { useState, useCallback, useMemo } from 'react';
import { ref, set, remove, update, get, runTransaction, increment, query, orderByKey, limitToLast, endBefore } from 'firebase/database';
import { getServerNow } from '@/features/timer/api/useTimer';
import { db } from '@/lib/firebase';
import { generateQuestionId } from '@/lib/utils';
import {
  getQuestionMode,
  getQuizReward,
  isQuizQuestion,
  normalizeQuizEvent,
} from '@/lib/quiz';
import { buildQuestionData, QUESTION_TYPE_FIELDS } from '@/lib/question';
import { MODE_CARD_TYPE } from '@/lib/modes';
import { useToast } from '@/hooks/useToast';

// 서버 시간 기준 — 강사 기기 시계 오차 없이 activatedAt/revealedAt/awardedAt 등
// 모든 시간 필드가 일관된 기준으로 저장됨 (timer의 endTime과 동일 기준).
function getNow() {
  return getServerNow();
}

// P1-6: revealQuiz가 점수 batch 도중에 currentQuestion이 바뀌면 학생이 lastPoints를
// 보기 전에 다음 질문으로 넘어감. module-level Map으로 동일 세션 내 모든
// useQuestionActions 인스턴스가 공유. revealQuiz Phase 2 시작 시 set, 끝나면 delete.
const revealLocks = new Map();

async function awaitRevealLock(sessionId) {
  const pending = revealLocks.get(sessionId);
  if (pending) await pending;
}

// P1-8: resetAllQuestions가 학생-write 영역(handRaises/urgentQuestions/chat)을 null로
// 비우는 순간 인플라이트 학생 write가 도착하면 잔존 데이터 발생. 600ms 후 재-sweep으로
// catch. 같은 세션에서 새 reset이 곧이어 발생하면 직전 sweep은 무효화 (epoch 비교).
const resetEpochs = new Map();

// 휘발성 피드(리액션·한마디)를 최근 KEEP개만 유지 — 스펙("최근 50개")과 달리 push만 하고
// 정리가 없어 세션 내내 무한 누적되던 것을, 질문 전환 시점(강사 단일 작성자)에 트림.
// 채팅/긴급질문은 '기록'이므로 트림하지 않음.
const FEED_KEEP = 50;
export async function trimEphemeralFeeds(sessionId) {
  for (const node of ['reactions', 'chatBubbles']) {
    try {
      const base = ref(db, `sessions/${sessionId}/${node}`);
      const keepSnap = await get(query(base, orderByKey(), limitToLast(FEED_KEEP)));
      const keepKeys = Object.keys(keepSnap.val() || {});
      if (keepKeys.length < FEED_KEEP) continue; // 50개 미만 — 정리 불필요
      const oldest = keepKeys.sort()[0];
      const oldSnap = await get(query(base, orderByKey(), endBefore(oldest)));
      const oldKeys = Object.keys(oldSnap.val() || {});
      if (!oldKeys.length) continue;
      const updates = {};
      oldKeys.forEach((k) => { updates[k] = null; });
      await update(base, updates);
    } catch { /* 정리 실패는 무해 — 다음 전환 때 재시도 */ }
  }
}

export function useQuestionActions(sessionId, questions, currentQuestion, scores, participants) {
  const [error, setError] = useState(null);
  const { toast, showToast } = useToast();

  const questionList = useMemo(
    () => Object.entries(questions || {}).sort((a, b) => (a[1].order || 0) - (b[1].order || 0)),
    [questions]
  );

  async function handleSubmit(fields) {
    try {
      setError(null);
      const qId = generateQuestionId();
      // type별 필드 조립은 buildQuestionData(순수함수, 테스트 보유)로 일원화 — 생성·수정 공유
      const questionData = {
        type: fields.type,
        title: fields.title.trim(),
        order: Object.keys(questions || {}).length + 1,
        ...buildQuestionData(fields.type, fields),
      };
      await set(ref(db, `sessions/${sessionId}/questions/${qId}`), questionData);
      return true;
    } catch {
      setError('질문 저장에 실패했습니다. 다시 시도해주세요.');
      return false;
    }
  }

  async function activateQuestion(qId, nextEvent) {
    const question = questions?.[qId];
    if (!question) return;

    // 모드 카드는 질문이 아니라 화면 전환이다. 목록에 미리 꽂아두고 순서대로 눌러 진행한다.
    if (question.type === MODE_CARD_TYPE) {
      try {
        const updates = { currentMode: question.mode, currentQuestion: null, timer: null };
        // 추첨 계열은 직전 판의 당첨자가 학생 폰에 다시 뜨지 않게 결과를 비운다
        if (question.mode === 'lottery' || question.mode === 'scratchCard') {
          updates.gameResult = null;
          updates.gameState = null;
        }
        await update(ref(db, `sessions/${sessionId}`), updates);
      } catch {
        showToast('모드 전환에 실패했습니다.');
      }
      return;
    }

    // 진행 중인 reveal batch 완료 대기 — lastPoints 보존
    if (revealLocks.has(sessionId)) {
      showToast('정답 공개 중... 잠시만 기다려주세요');
      await awaitRevealLock(sessionId);
    }

    try {
      const updates = {
        currentQuestion: qId,
        currentMode: getQuestionMode(question),
      };

      // 모든 질문 유형: 활성화 시 revealedAt 초기화
      updates[`questions/${qId}/activatedAt`] = getNow();
      updates[`questions/${qId}/revealedAt`] = null;
      // 이전 질문의 타이머 잔존 시 다음 질문까지 "시간 종료" 잠금이 전파되던 버그 — 전환 시 정리
      updates.timer = null;

      if (isQuizQuestion(question)) {
        updates[`questions/${qId}/awardedAt`] = null;
        if (nextEvent) {
          updates[`questions/${qId}/event`] = normalizeQuizEvent(nextEvent);
        }
      }

      // 힌트 퀴즈: 힌트도 초기화
      if (question.type === 'hintQuiz') {
        updates[`questions/${qId}/revealedHints`] = 0;
      }
      // 미스터리 박스/힌트 퀴즈: 당첨자 공개 초기화
      if (['mysteryBox', 'hintQuiz'].includes(question.type)) {
        updates[`questions/${qId}/revealedWinners`] = 0;
      }
      // 이미지 슬라이드: 첫 번째로 초기화
      if (question.type === 'imageSlide') {
        updates[`questions/${qId}/currentSlide`] = 0;
      }

      await update(ref(db, `sessions/${sessionId}`), updates);
      trimEphemeralFeeds(sessionId); // 비동기 — 실패 무해
      showToast('질문이 활성화되었습니다');
    } catch {
      // Silently fail
    }
  }

  const clearActive = useCallback(async () => {
    if (revealLocks.has(sessionId)) await awaitRevealLock(sessionId);
    try {
      await update(ref(db, `sessions/${sessionId}`), { currentQuestion: null, currentMode: 'waiting' });
    } catch {
      // Silently fail
    }
  }, [sessionId]);

  async function updateQuestion(qId, fields) {
    try {
      setError(null);
      const existing = questions?.[qId];
      if (!existing) return false;

      // 기존 질문에서 type별 필드(stale)를 모두 제거한 뒤, 새 type 기준으로 재조립.
      // 답변(votes)·메타(order/activatedAt 등)는 보존. 조립은 생성과 동일한 순수함수 사용.
      const questionData = { ...existing, type: fields.type, title: fields.title.trim() };
      QUESTION_TYPE_FIELDS.forEach((k) => delete questionData[k]);
      Object.assign(questionData, buildQuestionData(fields.type, fields));

      await set(ref(db, `sessions/${sessionId}/questions/${qId}`), questionData);
      showToast('질문이 수정되었습니다');
      return true;
    } catch {
      setError('질문 수정에 실패했습니다. 다시 시도해주세요.');
      return false;
    }
  }

  async function deleteQuestion(qId) {
    try {
      // 상시 과제(aiJudge)로 등록된 질문이면 세션의 persistentAssignmentId도 함께 정리 — 고아 참조 방지.
      const persistentSnap = await get(ref(db, `sessions/${sessionId}/persistentAssignmentId`));
      const isPersistent = persistentSnap.val() === qId;
      const updates = { [`questions/${qId}`]: null };
      if (isPersistent) updates.persistentAssignmentId = null;
      await update(ref(db, `sessions/${sessionId}`), updates);
      if (currentQuestion === qId) await clearActive();
      showToast('질문이 삭제되었습니다');
    } catch {
      // Silently fail
    }
  }

  async function duplicateQuestion(qId) {
    const source = questions?.[qId];
    if (!source) return;

    try {
      setError(null);
      const newId = generateQuestionId();
      const nextOrder = questionList.length + 1;
      const { votes: _votes, aiGrades: _aiGrades, activatedAt: _activatedAt, revealedAt: _revealedAt, awardedAt: _awardedAt, event: _event, ...rest } = source;
      await set(ref(db, `sessions/${sessionId}/questions/${newId}`), { ...rest, title: `${source.title} (복사)`, order: nextOrder });
      showToast('질문이 복제되었습니다');
    } catch {
      setError('질문 복제에 실패했습니다. 다시 시도해주세요.');
    }
  }

  async function moveQuestion(qId, direction) {
    const idx = questionList.findIndex(([id]) => id === qId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= questionList.length) return;

    const [currentId, currentQ] = questionList[idx];
    const [swapId, swapQ] = questionList[swapIdx];

    try {
      await update(ref(db, `sessions/${sessionId}`), {
        [`questions/${currentId}/order`]: swapQ.order ?? swapIdx + 1,
        [`questions/${swapId}/order`]: currentQ.order ?? idx + 1,
      });
    } catch {
      // Silently fail
    }
  }

  async function reorderQuestion(fromId, toId) {
    const fromIdx = questionList.findIndex(([id]) => id === fromId);
    const toIdx = questionList.findIndex(([id]) => id === toId);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;

    try {
      const updates = {};
      const reordered = [...questionList];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      reordered.forEach(([id], i) => { updates[`questions/${id}/order`] = i + 1; });
      await update(ref(db, `sessions/${sessionId}`), updates);
    } catch {
      // Silently fail
    }
  }

  async function importFromLibrary(libraryQuestions) {
    if (!libraryQuestions || libraryQuestions.length === 0) return;
    try {
      const updates = {};
      const currentCount = questionList.length;
      libraryQuestions.forEach((lq, i) => {
        const newId = generateQuestionId();
        const { id: _id, savedAt: _s, updatedAt: _u, tag: _t, ...questionData } = lq;
        updates[`questions/${newId}`] = { ...questionData, order: currentCount + i + 1 };
      });
      await update(ref(db, `sessions/${sessionId}`), updates);
      showToast(`${libraryQuestions.length}개 질문이 추가되었습니다`);
    } catch {
      setError('보관함에서 질문 가져오기에 실패했습니다.');
    }
  }

  async function revealQuiz(qId) {
    const question = questions?.[qId];
    if (!isQuizQuestion(question)) return;

    try {
      const now = getNow();
      const voteEntries = Object.entries(question.votes || {});

      // Phase 1: Reveal answer
      await update(ref(db, `sessions/${sessionId}`), {
        currentMode: 'quiz',
        [`questions/${qId}/revealedAt`]: now,
      });

      // awardedAt을 트랜잭션으로 '선점' — 강사 다중 기기(노트북+태블릿)가 동시에
      // 정답공개를 눌러도 커밋 승자 1명만 Phase 2(점수 지급)를 실행. 로컬 스냅샷
      // 가드(question.awardedAt)만으론 sync 지연 윈도우에서 이중 지급 가능했음.
      let iAward = false;
      if (!question.awardedAt) {
        const claim = await runTransaction(
          ref(db, `sessions/${sessionId}/questions/${qId}/awardedAt`),
          (cur) => (cur ? undefined : now) // 이미 있으면 abort
        );
        iAward = claim.committed;
      }

      // Phase 2: Score updates in batches of 50 — lock으로 감싸 도중 currentQuestion 변경 방지
      if (iAward) {
        // 이전 reveal이 아직 batch 도중이면 (드물게) 완료 대기
        await awaitRevealLock(sessionId);
        let resolveLock;
        const lockPromise = new Promise((r) => { resolveLock = r; });
        revealLocks.set(sessionId, lockPromise);
        try {
          const BATCH_SIZE = 50;
          for (let i = 0; i < voteEntries.length; i += BATCH_SIZE) {
            const batch = voteEntries.slice(i, i + BATCH_SIZE);
            const scoreUpdates = {};
            batch.forEach(([participantId, vote]) => {
              const reward = getQuizReward(question, vote);
              const existingScore = (scores || {})[participantId] || {};
              const nextStreak = reward.isCorrect ? (existingScore.streak || 0) + 1 : 0;
              const nickname = (participants || {})[participantId]?.nickname || vote.nickname || existingScore.nickname || `참여자 ${participantId.slice(0, 4)}`;
              // (예: 다른 점수 변경)을 stale 스냅샷으로 덮어 유실시킬 수 있음.
              // (베팅 패널티로 이론상 0 미만 가능하나 표시 계층에서 무해 — 기본 이벤트는 항상 ≥0)
              scoreUpdates[`scores/${participantId}/total`] = increment(reward.points);
              scoreUpdates[`scores/${participantId}/nickname`] = nickname;
              scoreUpdates[`scores/${participantId}/lastPoints`] = reward.points;
              scoreUpdates[`scores/${participantId}/streak`] = nextStreak;
              scoreUpdates[`scores/${participantId}/bestStreak`] = Math.max(existingScore.bestStreak || 0, nextStreak);
              scoreUpdates[`scores/${participantId}/lastQuestionId`] = qId;
              scoreUpdates[`scores/${participantId}/updatedAt`] = now;
            });
            await update(ref(db, `sessions/${sessionId}`), scoreUpdates);
          }
        } finally {
          revealLocks.delete(sessionId);
          resolveLock();
        }
      }
    } catch {
      setError('정답 공개와 점수 반영에 실패했습니다. 다시 시도해주세요.');
    }
  }

  async function revealHint(qId) {
    const question = questions?.[qId];
    if (question?.type !== 'hintQuiz') return;
    const maxHints = (question.hints || []).length;
    const current = question.revealedHints || 0;
    if (current >= maxHints) return;
    try {
      await update(ref(db, `sessions/${sessionId}`), {
        [`questions/${qId}/revealedHints`]: current + 1,
      });
    } catch {
      // Silently fail
    }
  }

  // 이미지 슬라이드 이동 — 대시보드/발표모드 공용 (전자칠판·학생은 currentSlide 구독)
  async function setSlide(qId, index) {
    const question = questions?.[qId];
    if (question?.type !== 'imageSlide') return;
    const total = (question.slideImages || []).length;
    if (!total) return;
    const next = Math.max(0, Math.min(total - 1, index));
    try {
      await update(ref(db, `sessions/${sessionId}`), {
        [`questions/${qId}/currentSlide`]: next,
      });
    } catch {
      // Silently fail
    }
  }

  async function revealAnswer(qId) {
    const question = questions?.[qId];
    if (!question) return;
    // quiz 타입은 revealQuiz를 사용, 나머지 정답형은 여기서 처리
    if (isQuizQuestion(question)) return;
    try {
      await update(ref(db, `sessions/${sessionId}`), {
        [`questions/${qId}/revealedAt`]: getNow(),
      });
    } catch {
      setError('정답 공개에 실패했습니다.');
    }
  }

  const showLeaderboard = useCallback(async () => {
    if (revealLocks.has(sessionId)) await awaitRevealLock(sessionId);
    try {
      await update(ref(db, `sessions/${sessionId}`), { currentMode: 'leaderboard' });
    } catch {
      setError('리더보드 전환에 실패했습니다. 다시 시도해주세요.');
    }
  }, [sessionId]);

  const armEvent = useCallback(async (eventPreset) => {
    try {
      setError(null);
      await set(ref(db, `sessions/${sessionId}/pendingEvent`), eventPreset);
    } catch {
      setError('이벤트 예약에 실패했습니다. 다시 시도해주세요.');
    }
  }, [sessionId]);

  const clearPendingEvent = useCallback(async () => {
    try {
      setError(null);
      await remove(ref(db, `sessions/${sessionId}/pendingEvent`));
    } catch {
      setError('이벤트 해제에 실패했습니다. 다시 시도해주세요.');
    }
  }, [sessionId]);

  async function resetQuestion(qId) {
    try {
      await update(ref(db, `sessions/${sessionId}`), {
        [`questions/${qId}/votes`]: null,
        [`questions/${qId}/aiGrades`]: null,
        [`questions/${qId}/revealedAt`]: null,
        [`questions/${qId}/activatedAt`]: null,
        // awardedAt 미정리 시 재진행 후 정답공개가 선점 가드에 막혀 점수가 영영 안 나감
        [`questions/${qId}/awardedAt`]: null,
        [`questions/${qId}/revealedHints`]: 0,
        [`questions/${qId}/revealedWinners`]: 0,
        [`questions/${qId}/currentSlide`]: 0,
        // 주관식 부속 상태도 리셋 (스포트라이트 잔존/재선정 차단/확장 잔존 방지)
        [`questions/${qId}/spotlight`]: null,
        [`questions/${qId}/spotlightAwarded`]: null,
        [`questions/${qId}/wallExpanded`]: null,
      });
      showToast('답변이 초기화되었습니다');
    } catch {
      setError('초기화에 실패했습니다.');
    }
  }

  async function resetAllQuestions(clearParticipants = false) {
    try {
      const updates = {
        gameResult: null,
        gameState: null,
        drumroll: null,
        currentQuestion: null,
        currentMode: 'waiting',
        scores: null,
        reactions: null,
        chat: null,
        handRaises: null,
        urgentQuestions: null,
        staffChat: null,
        // classQuestions, qaStats는 세션 누적 데이터로 초기화하지 않음
        // 리허설→본행사: 참여자까지 비우면 접속자/추첨 대상이 깨끗해짐
        ...(clearParticipants ? { participants: null } : {}),
      };
      questionList.forEach(([qId]) => {
        updates[`questions/${qId}/votes`] = null;
        updates[`questions/${qId}/aiGrades`] = null;
        updates[`questions/${qId}/revealedAt`] = null;
        updates[`questions/${qId}/activatedAt`] = null;
        updates[`questions/${qId}/awardedAt`] = null;
        updates[`questions/${qId}/revealedHints`] = 0;
        updates[`questions/${qId}/revealedWinners`] = 0;
        updates[`questions/${qId}/currentSlide`] = 0;
        updates[`questions/${qId}/spotlight`] = null;
        updates[`questions/${qId}/spotlightAwarded`] = null;
        updates[`questions/${qId}/wallExpanded`] = null;
      });
      await update(ref(db, `sessions/${sessionId}`), updates);
      showToast('모든 답변과 점수가 초기화되었습니다');

      // P1-8: 600ms 후 학생-write 영역만 다시 sweep — 인플라이트 race 잔존 방지.
      // 같은 세션에서 또 다른 reset이 일어나면 본 sweep은 폐기.
      const epoch = Date.now();
      resetEpochs.set(sessionId, epoch);
      setTimeout(() => {
        if (resetEpochs.get(sessionId) !== epoch) return;
        update(ref(db, `sessions/${sessionId}`), {
          handRaises: null,
          urgentQuestions: null,
          chat: null,
        }).catch(() => { /* sweep 실패해도 본 reset은 이미 성공 */ });
      }, 600);
    } catch {
      setError('전체 초기화에 실패했습니다.');
    }
  }

  return {
    error,
    setError,
    toast,
    showToast,
    questionList,
    handleSubmit,
    updateQuestion,
    activateQuestion,
    clearActive,
    deleteQuestion,
    duplicateQuestion,
    moveQuestion,
    reorderQuestion,
    importFromLibrary,
    revealQuiz,
    revealHint,
    revealAnswer,
    setSlide,
    resetQuestion,
    resetAllQuestions,
    showLeaderboard,
    armEvent,
    clearPendingEvent,
  };
}
