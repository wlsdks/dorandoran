import { useState, useMemo, useEffect, useRef, memo } from 'react';
import { ref, onValue, set, update, increment, runTransaction, serverTimestamp } from 'firebase/database';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, Users, X, Star } from 'lucide-react';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { useVotes } from '@/hooks/useVotes';
import { gradeSubjective, isGradingReady } from '@/features/questions/api/gradeSubjective';
import Badge from '@/components/ui/Badge';
import { TYPE_LABELS } from '@/lib/question-types';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import Avatar from '@/components/ui/Avatar';

// 하우스 스타일(AnswerRevealCard 준거): 긍정=emerald, 나머지=slate 모노크로매틱. 신호등 색상 미사용.
function scoreColor(score) {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10';
  return 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700';
}

function DetailModal({ item, grade, onClose, isAdmin, isSpotlit, onSpotlight }) {
  if (!item) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-lg"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <Avatar name={item.nickname || '익명'} size="sm" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.nickname || '익명'}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X size={18} />
          </button>
        </div>
        <p className="text-base text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-wrap break-words">{item.value}</p>
        {grade && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-sm font-bold px-2 py-0.5 rounded-md ${scoreColor(grade.score)}`}>{grade.score}점</span>
            </div>
            {grade.feedback && <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{grade.feedback}</p>}
          </div>
        )}
        {/* 우수 답변 스포트라이트 — 전자칠판에 크게 + 최초 1회 티켓 +3 */}
        {isAdmin && (
          <button
            onClick={() => onSpotlight(item)}
            className={`mt-5 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-colors active:scale-[0.98] ${
              isSpotlit
                ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                : 'bg-amber-400 hover:bg-amber-300 text-slate-900'
            }`}
          >
            <Star size={15} fill={isSpotlit ? 'none' : 'currentColor'} />
            {isSpotlit ? '스포트라이트 내리기' : '전자칠판에 스포트라이트 (+티켓 3장)'}
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}

// 스크롤 없이 채우는 최신 답변 수(3열×N행) — 뷰포트 높이에 맞춰 6/5/4행. 초과분은 더보기로.
const wallLimitFor = (vh) => (vh >= 1040 ? 18 : vh >= 920 ? 15 : 12);

export default memo(function SubjectiveResults({ sessionId, questionId, question, isAdmin }) {
  const { voteList } = useVotes(sessionId, questionId);
  const [selected, setSelected] = useState(null);
  // 더보기 확장을 question.wallExpanded로 동기화 — 발표모드에서 누르면 전자칠판도 함께 확장/접힘
  const expanded = !!question?.wallExpanded;
  const toggleExpanded = () => {
    update(ref(db, `sessions/${sessionId}/questions/${questionId}`), { wallExpanded: !expanded }).catch(() => {});
  };
  const [grades, setGrades] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const title = question?.title;
  const modelAnswer = question?.modelAnswer || '';

  useEffect(() => {
    if (!sessionId || !questionId) return;
    const gradesRef = ref(db, `sessions/${sessionId}/questions/${questionId}/aiGrades`);
    const unsub = onValue(gradesRef, (snap) => setGrades(snap.val() || {}));
    return () => unsub();
  }, [sessionId, questionId]);

  const sorted = useMemo(
    () => [...voteList].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)),
    [voteList]
  );

  // 차분한 append 방식 — 칸 위치는 고정, 새 답변은 다음 빈 칸(왼→오)에 fade-in, 꽉 차면
  // 가장 오래된 칸부터 순환 교체. 재배치·밀림이 없어 어지럽지 않다. 0.8초에 딱 한 장씩만
  // 흘리고, '한 번도 안 보여준 진짜 신규'만 테두리 glow(indigo)로 표시 → 새 답변이 명확.
  const sortedRef = useRef(sorted);
  useEffect(() => { sortedRef.current = sorted; }, [sorted]);
  const slotsRef = useRef([]);
  const ptrRef = useRef(0);
  const seenRef = useRef(new Set()); // 한 번이라도 벽에 올린 답변 id(영구) — 재등장·재반짝 방지
  const seededRef = useRef(false);
  const [slots, setSlots] = useState([]);
  const [wallLimit, setWallLimit] = useState(() => wallLimitFor(typeof window !== 'undefined' ? window.innerHeight : 1080));
  const wallLimitRef = useRef(wallLimit);
  useEffect(() => {
    const calc = () => setWallLimit(wallLimitFor(window.innerHeight));
    calc(); window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);
  useEffect(() => {
    wallLimitRef.current = wallLimit;
    if (slotsRef.current.length > wallLimit) { // 축소 시 즉시 잘라 스크롤 제거
      slotsRef.current = slotsRef.current.slice(0, wallLimit);
      ptrRef.current = ptrRef.current % wallLimit;
      setSlots([...slotsRef.current]);
    }
  }, [wallLimit]);

  // 질문 전환 시 시드 초기화 → 다음 로드에서 다시 씨딩.
  useEffect(() => {
    seededRef.current = false;
  }, [questionId]);

  // 첫 로드(sorted가 처음 채워질 때): 현재 답변 '전체'를 seen 처리하고 최신 wallLimit개를
  // 즉시 벽에 깐다. → 리로드로 기존 답변이 한꺼번에 들어와도 반짝이지 않고, 이후 신규만 glow.
  useEffect(() => {
    if (seededRef.current || sorted.length === 0) return;
    seededRef.current = true;
    const recent = sorted.slice(0, wallLimitRef.current); // newest first
    slotsRef.current = recent;
    ptrRef.current = 0;
    seenRef.current = new Set(sorted.map((v) => v.id));
    setSlots([...recent]);
  }, [sorted]);

  useEffect(() => {
    const step = () => {
      // '한 번도 안 보여준' 진짜 신규 1개만(sorted는 newest first → 최신부터). 밀려난 옛 답변은 재선택 안 됨.
      const next = sortedRef.current.find((v) => !seenRef.current.has(v.id));
      if (!next) return; // 신규 없음 → 완전 유휴(재배치·반짝임 0)
      seenRef.current.add(next.id);
      if (slotsRef.current.length < wallLimitRef.current) {
        slotsRef.current = [...slotsRef.current, next]; // 채움 단계 — 다음 빈 칸
      } else {
        slotsRef.current = slotsRef.current.slice();
        slotsRef.current[ptrRef.current] = next; // 순환 교체 — 가장 오래된 칸부터
        ptrRef.current = (ptrRef.current + 1) % wallLimitRef.current;
      }
      setSlots([...slotsRef.current]);
    };
    const id = setInterval(step, 800);
    return () => clearInterval(id);
  }, []);

  // 우수 답변 스포트라이트 — question.spotlight로 전 서페이스(전자칠판/발표/대시보드) 동기
  const spotlight = question?.spotlight || null;
  const toggleSpotlight = async (vote) => {
    const qRef = ref(db, `sessions/${sessionId}/questions/${questionId}`);
    if (spotlight?.voteId === vote.id) {
      await update(qRef, { spotlight: null }).catch(() => {});
    } else {
      await update(qRef, { spotlight: { voteId: vote.id, pid: vote.id, nickname: vote.nickname || '익명', value: vote.value, at: Date.now() } }).catch(() => {});
      // 보상 선점을 트랜잭션으로 — 두 강사 화면이 동시에 같은 답변을 픽해도 +3은 1회만
      try {
        const claim = await runTransaction(
          ref(db, `sessions/${sessionId}/questions/${questionId}/spotlightAwarded/${vote.id}`),
          (cur) => (cur ? undefined : true)
        );
        if (claim.committed) {
          // total: increment(0) — 스코어 노드가 없던 학생도 rules validate(nickname+total 필수) 통과
          await update(ref(db, `sessions/${sessionId}/scores/${vote.id}`), {
            tickets: increment(3), total: increment(0), nickname: vote.nickname || '익명',
          });
        }
      } catch { /* 선점 실패(이미 지급) — 무시 */ }
    }
    setSelected(null);
  };

  const gradedCount = Object.keys(grades).length;
  const canGrade = isAdmin && isGradingReady() && modelAnswer && sorted.length > 0 && !loading;

  async function handleGrade() {
    if (!canGrade) return;
    setLoading(true);
    setError('');
    try {
      const responses = voteList.map((v) => ({ id: v.id, value: v.value })).filter((r) => r.value);
      const results = await gradeSubjective({ questionTitle: title, modelAnswer, responses });
      await Promise.all(
        results.map((g) =>
          set(ref(db, `sessions/${sessionId}/questions/${questionId}/aiGrades/${g.id}`), {
            score: g.score,
            feedback: g.feedback,
            gradedAt: serverTimestamp(),
          })
        )
      );
    } catch (err) {
      logger.error('Grade failed:', err);
      setError(err.message || 'AI 채점에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="w-full max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="mb-1.5"><Badge variant="primary">{TYPE_LABELS[question?.type] || '주관식'}</Badge></div>
            {title && <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-tight mb-1">{title}</h2>}
            <div className="flex items-center gap-3 text-sm text-slate-400 dark:text-slate-500">
              <span className="flex items-center gap-1"><Users size={14} />{sorted.length}명 응답</span>
              {gradedCount > 0 && <span>· {gradedCount}명 채점됨</span>}
            </div>
          </div>
          {isAdmin && isGradingReady() && (
            <button
              onClick={handleGrade}
              disabled={!canGrade}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0 ${
                canGrade
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {loading ? '채점 중' : gradedCount > 0 ? '다시 채점' : 'AI 채점'}
            </button>
          )}
        </div>

        {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

        <div className="relative">
        {/* 스포트라이트 오버레이 — 벽 위에 크게, 강사만 닫기 가능 */}
        <AnimatePresence>
          {spotlight && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-slate-950/60 backdrop-blur-[2px] p-6"
            >
              <motion.div
                initial={{ scale: 0.9, y: 16, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl ring-2 ring-amber-400/70 px-8 py-7"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex items-center gap-1.5 text-amber-500 text-sm font-bold"><Star size={16} fill="currentColor" />우수 답변</span>
                  <span className="text-xs font-semibold text-slate-400">티켓 +3</span>
                  {isAdmin && (
                    <button onClick={() => toggleSpotlight({ id: spotlight.voteId, nickname: spotlight.nickname, value: spotlight.value })}
                      className="ml-auto text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label="스포트라이트 내리기">
                      <X size={18} />
                    </button>
                  )}
                </div>
                <p className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 leading-relaxed break-words">“{spotlight.value}”</p>
                <div className="mt-4 flex items-center gap-2">
                  <Avatar name={spotlight.nickname} size="sm" />
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{spotlight.nickname}</span>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 응답 벽 — 각 칸 위치 고정. 새 답변은 다음 빈 칸/가장 오래된 칸에서 '제자리 크로스페이드'로
            들어오고 그때만 테두리 glow. 재배치·밀림이 없어 어지럽지 않다. 더보기는 같은 높이 안에서 내부 스크롤. */}
        {expanded ? (
          /* 확장 시에도 접힌 벽과 '같은 높이' 유지 — 페이지 스크롤 대신 이 안에서만 스크롤 */
          <div
            className="flex flex-wrap gap-3 content-start overflow-y-auto scrollbar-hide pr-1"
            style={{ maxHeight: (wallLimit / 3) * 104 + (wallLimit / 3 - 1) * 12 }}
          >
            {sorted.map((vote) => {
              const grade = grades[vote.id];
              return (
                <button
                  key={vote.id}
                  onClick={() => setSelected(vote)}
                  className="w-full sm:w-[calc(50%-0.375rem)] xl:w-[calc(33.333%-0.5rem)] h-[104px] overflow-hidden text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3.5 hover:border-slate-300 dark:hover:border-slate-600 transition-colors duration-150"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Avatar name={vote.nickname || '익명'} size="sm" />
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">{vote.nickname || '익명'}</span>
                    {grade && <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ml-auto shrink-0 ${scoreColor(grade.score)}`}>{grade.score}점</span>}
                  </div>
                  <p className="text-[15px] text-slate-700 dark:text-slate-200 leading-relaxed break-words line-clamp-2">{vote.value}</p>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-3 content-start">
            {slots.map((vote, idx) => (
              <div key={idx} className="relative w-full sm:w-[calc(50%-0.375rem)] xl:w-[calc(33.333%-0.5rem)] h-[104px]">
                {/* initial={false} → 초기 채움은 반짝임 없이, 이후 새로 들어온 답변만 glow */}
                <AnimatePresence initial={false}>
                  {vote && (
                    <motion.button
                      key={vote.id}
                      initial={{ opacity: 0 }}
                      animate={{
                        opacity: 1,
                        boxShadow: [
                          '0 0 0 0 rgba(99,102,241,0)',
                          '0 0 16px 2px rgba(99,102,241,0.45)',
                          '0 0 0 0 rgba(99,102,241,0)',
                        ],
                      }}
                      exit={{ opacity: 0 }}
                      transition={{
                        opacity: { duration: 0.5, ease: 'easeInOut' },
                        boxShadow: { duration: 1.5, times: [0, 0.3, 1], ease: 'easeOut' },
                      }}
                      onClick={() => setSelected(vote)}
                      className="absolute inset-0 overflow-hidden text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3.5 hover:border-slate-300 dark:hover:border-slate-600 transition-colors duration-150"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <Avatar name={vote.nickname || '익명'} size="sm" />
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">{vote.nickname || '익명'}</span>
                        {grades[vote.id] && <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ml-auto shrink-0 ${scoreColor(grades[vote.id].score)}`}>{grades[vote.id].score}점</span>}
                      </div>
                      <p className="text-[15px] text-slate-700 dark:text-slate-200 leading-relaxed break-words line-clamp-2">{vote.value}</p>
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}

        {/* 더보기 / 접기 — wallLimit 초과 시에만 */}
        {sorted.length > wallLimit && (
          <div className="mt-5 text-center">
            <button
              onClick={toggleExpanded}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors duration-150"
            >
              {expanded ? '접기' : `전체 ${sorted.length}개 응답 더보기`}
            </button>
          </div>
        )}

        {sorted.length === 0 && (
          <div className="text-center py-20 space-y-3 flex flex-col items-center">
            <DoranDoranMascot size="sm" />
            <div>
              <p className="text-slate-400 dark:text-slate-500 text-sm">아직 답변이 없습니다</p>
              <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">학생들이 답변하면 여기에 표시됩니다</p>
            </div>
          </div>
        )}
        </div>
      </div>

      <AnimatePresence>
        {selected && (
          <DetailModal
            item={selected}
            grade={grades[selected.id]}
            onClose={() => setSelected(null)}
            isAdmin={isAdmin}
            isSpotlit={spotlight?.voteId === selected.id}
            onSpotlight={toggleSpotlight}
          />
        )}
      </AnimatePresence>
    </>
  );
});
