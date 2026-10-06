import { memo, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { reveal, spring } from '@/lib/motion';
import { Trophy, Medal, Award, Lock, X, TrendingUp, AlertCircle, MessageCircle, Code2, Lightbulb } from 'lucide-react';
import { createPortal } from 'react-dom';
import { getJudgeById } from '@/lib/judging/judges';

// §1 그라디언트 금지 — 단색 + 톤 차로 위계 유지 (amber-500 vs amber-400, slate-400)
const RANK_META = [
  { key: 'first', title: '1등', color: 'bg-amber-500', Icon: Trophy },
  { key: 'second', title: '2등', color: 'bg-slate-400', Icon: Medal },
  { key: 'third', title: '3등', color: 'bg-amber-400', Icon: Award },
];

// 공개 순서 기준 — 실제 존재하는 랭크만 순회.
const ALL_ORDER = ['third', 'second', 'first'];

/**
 * LiveResultHero — 학생 쪽 결과.
 * 본인 결과는 항상 노출. TOP 공개는 강사가 단계별로 해금(revealedUpTo)하며 순차 드러남.
 */
export default memo(function LiveResultHero({ top3, myParticipantId, myResult, mySubmission, revealedUpTo = 0, results }) {
  const myRank = Object.entries(top3 || {}).find(([, v]) => v.submissionId === myParticipantId)?.[0];
  const myRankMeta = myRank ? RANK_META.find(r => r.key === myRank) : null;
  const myAvg = myResult?.summary?.avgScore;

  // 본인 전체 등수 계산 — TOP3 밖이어도 "21/30" 표시. 위로 + 점수 맥락 제공.
  // topPercent: 1등=3% (상위 3% 이내), 꼴찌=100%. 작을수록 잘함.
  const myOverallRank = useMemo(() => {
    if (!results || !myParticipantId) return null;
    const all = Object.entries(results)
      .filter(([, r]) => (r.summary?.totalJudges ?? 0) > 0)
      .map(([pid, r]) => ({ pid, avg: r.summary?.avgScore ?? 0 }))
      .sort((a, b) => b.avg - a.avg);
    const idx = all.findIndex(e => e.pid === myParticipantId);
    if (idx < 0 || all.length === 0) return null;
    const rank = idx + 1;
    const topPercent = Math.max(1, Math.round((rank / all.length) * 100));
    return { rank, total: all.length, topPercent };
  }, [results, myParticipantId]);
  // 실제 존재하는 랭크만 (제출 1~2명일 때 빈 슬롯 방지)
  const revealOrder = ALL_ORDER.filter((k) => top3?.[k]);
  const myRankVisible = myRank
    ? revealOrder.slice(0, revealedUpTo).includes(myRank)
    : false;

  // 클릭한 랭크의 상세 사유 모달
  const [detailRank, setDetailRank] = useState(null);
  const detailWinner = detailRank ? top3?.[detailRank] : null;
  const detailMeta = detailRank ? RANK_META.find(r => r.key === detailRank) : null;

  // 본인 결과 카드의 "전체 7명 심사평" 모달
  const [showAllComments, setShowAllComments] = useState(false);

  return (
    <div className="space-y-4">
      {/* 본인 결과 카드 — 항상 공개 */}
      {mySubmission && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring.default}
          className={`relative overflow-hidden rounded-2xl border ${
            myRank === 'first' && myRankVisible
              ? 'border-amber-300 dark:border-amber-500/70 ring-4 ring-amber-200/80 dark:ring-amber-400/60 shadow-2xl shadow-amber-500/20'
              : myRankMeta && myRankVisible
              ? 'border-amber-300 dark:border-amber-500/60 ring-2 ring-amber-200 dark:ring-amber-400/50'
              : 'border-slate-100 dark:border-slate-700'
          } bg-white dark:bg-slate-800`}
        >
          {/* 내 이미지 썸네일 — "내 거 잘 들어갔나?" 불안 해소.
              이미지 없고 코드만 제출했으면 코드 배지 표시. */}
          {mySubmission.imageUrl ? (
            <img src={mySubmission.imageUrl} alt="내 제출물" className="w-full max-h-48 object-cover" />
          ) : mySubmission.code ? (
            <div className="w-full bg-slate-900 dark:bg-slate-950 px-5 py-4 flex items-center gap-2 text-slate-300 border-b border-slate-800">
              <Code2 size={14} className="text-amber-400 shrink-0" />
              <span className="text-[12px] font-mono uppercase tracking-wider">HTML 코드 제출</span>
              <span className="ml-auto text-[11px] text-slate-500 tabular-nums">{mySubmission.code.length.toLocaleString()}자</span>
            </div>
          ) : null}

          {myRankMeta && myRankVisible && (
            <motion.div
              initial={{ scale: 0 }}
              animate={myRank === 'first' ? { scale: [0, 1.15, 1] } : { scale: 1 }}
              transition={{ ...spring.bouncy, delay: 0.1 }}
              className={`absolute top-2 right-2 px-3 py-1.5 rounded-full ${myRankMeta.color} text-white text-sm font-bold shadow-lg flex items-center gap-1.5`}
            >
              <myRankMeta.Icon size={14} /> {myRankMeta.title}
              {myRank === 'first' && (
                <motion.span
                  animate={{ scale: [1, 1.3, 1], rotate: [0, 15, -15, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  className="inline-block"
                  aria-hidden="true"
                >
                  <Lightbulb size={14} />
                </motion.span>
              )}
            </motion.div>
          )}

          {/* 1등 축하 메시지 — 본인이 1등이면 카드 상단에 큰 배너 */}
          {myRank === 'first' && myRankVisible && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-amber-500 text-white px-5 py-2.5 flex items-center gap-2"
            >
              <Trophy size={16} />
              <p className="font-bold text-sm">축하해요! 1등이에요</p>
            </motion.div>
          )}

          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Lightbulb size={14} className="text-slate-400" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">내 결과</p>
            </div>
            {mySubmission.title && (
              <p className="text-slate-900 dark:text-slate-100 text-base font-semibold break-words">{mySubmission.title}</p>
            )}
            {/* 코드만 제출한 학생용 — 본인이 뭘 냈는지 한번 더 보고 싶을 때 details로 펼침 */}
            {mySubmission.code && !mySubmission.imageUrl && (
              <details className="text-xs group">
                <summary className="cursor-pointer text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 list-none flex items-center gap-1.5">
                  <Code2 size={12} />
                  <span>내가 제출한 코드 보기</span>
                </summary>
                <pre className="mt-2 max-h-56 overflow-auto p-3 bg-slate-50 dark:bg-slate-900 rounded-lg text-[11px] leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-all">
                  {mySubmission.code.slice(0, 3000)}{mySubmission.code.length > 3000 && '\n...'}
                </pre>
              </details>
            )}
            {typeof myAvg === 'number' && (
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{myAvg.toFixed(1)}</span>
                  <span className="text-sm text-slate-400">/ 10점</span>
                  {/* 9점 이상은 매우 드문 수작 — "AI 극찬" 라벨로 학생 자존감 부스트 */}
                  {myAvg >= 9 && (
                    <motion.span
                      initial={{ scale: 0, rotate: -8 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 360, damping: 18, delay: 0.3 }}
                      className="ml-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider"
                    >
                      AI 극찬
                    </motion.span>
                  )}
                </div>
                {/* TOP3 밖이어도 전체 등수 + 상위 % — 본인 위치를 알려줘 박탈감 완화 */}
                {myOverallRank && !myRank && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    <TrendingUp size={11} />
                    <span className="tabular-nums">{myOverallRank.rank}</span>
                    <span className="text-slate-400">/ {myOverallRank.total}명</span>
                    {myOverallRank.topPercent <= 50 && (
                      <span className="text-slate-400">· 상위 {myOverallRank.topPercent}%</span>
                    )}
                  </div>
                )}
              </div>
            )}
            {/* TOP3 밖 위로 메시지 — 점수(myAvg)와 등수(topPercent) 둘 다 고려해 분기.
                점수가 높아도 다른 학생이 더 잘해서 TOP3 못 들어간 경우 별도 격려. */}
            {!myRank && myOverallRank && typeof myAvg === 'number' && (
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pt-1">
                {myAvg >= 8
                  ? `${myAvg.toFixed(1)}점! 점수만 보면 충분히 잘했어요 — TOP3는 정말 박빙이었네요`
                  : myAvg >= 7 && myOverallRank.topPercent <= 50
                  ? `${myAvg.toFixed(1)}점, 상위 ${myOverallRank.topPercent}%! 다음 번엔 TOP3 가능해요`
                  : myOverallRank.topPercent <= 33
                  ? '상위권이에요! 조금만 더 다듬으면 TOP3도 가능해요'
                  : myOverallRank.topPercent <= 66
                  ? `전체 ${myOverallRank.total}명 중 ${myOverallRank.rank}등! 좋은 시도였어요`
                  : '시도 자체가 의미 있었어요. 다음엔 더 좋은 결과 기대할게요'}
              </p>
            )}
            {myResult?.judges && <JudgeBars judges={myResult.judges} />}
            {/* 이미지 거부 시 안내 — Gemini가 이미지를 못 보고 텍스트(제목/설명)만으로 평가했음을 알림 */}
            {myResult?.summary?.imageFailed && (
              <div className="flex items-start gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <AlertCircle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  AI가 이미지를 불러오지 못해 텍스트(제목·설명)만으로 평가했어요.
                  다음 번엔 명확한 사진으로 다시 시도해보세요.
                </p>
              </div>
            )}
            {myResult?.judges && <JudgeComments judges={myResult.judges} />}
            {/* 전체 7판사 코멘트 펼치기 — 대표 코멘트(JudgeComments)는 best 1명만 보여서 나머지가 궁금한 학생용 */}
            {myResult?.judges && (
              <button
                type="button"
                onClick={() => setShowAllComments(true)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[40px] text-[12px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/40 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
              >
                <MessageCircle size={13} /> 전체 7명 심사평 보기
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* TOP 3 — 강사가 단계별로 해금 */}
      <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Trophy size={14} className="text-slate-400" />
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
            {revealOrder.length === 1 ? '결과' : `TOP ${revealOrder.length}`}
          </p>
          <span className="ml-auto text-[11px] text-slate-400 tabular-nums">공개 {Math.min(revealedUpTo, revealOrder.length)}/{revealOrder.length}</span>
        </div>

        {revealedUpTo === 0 ? (
          <div className="flex flex-col items-center py-6 gap-2">
            <Lock size={20} className="text-slate-300" />
            <p className="text-sm text-slate-400">강사님이 곧 순위를 공개합니다</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <AnimatePresence initial={false}>
              {/* 공개된 순위 — 1등이 가장 위에 오도록 역순 렌더. revealOrder는 드라마틱 공개용(3→2→1)이라 유지하고 표시만 뒤집음. */}
              {[...revealOrder.slice(0, revealedUpTo)].reverse().map((key) => {
                const meta = RANK_META.find(r => r.key === key);
                const w = top3?.[key];
                if (!w) return null;
                const isMe = w.submissionId === myParticipantId;
                return (
                  <motion.button
                    key={key}
                    layout
                    type="button"
                    onClick={() => setDetailRank(key)}
                    initial={{ opacity: 0, scale: 0.9, y: -8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={reveal}
                    className={`w-full text-left flex items-start gap-3 p-3 rounded-xl transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
                      isMe
                        ? 'bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200'
                        : 'bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                    aria-label={`${meta.title} ${w.name} 상세 사유 보기`}
                  >
                    <div className={`w-9 h-9 rounded-lg ${meta.color} flex items-center justify-center shrink-0`}>
                      <meta.Icon size={16} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className={`text-sm font-bold shrink-0 ${isMe ? 'text-white dark:text-slate-900' : 'text-slate-900 dark:text-slate-100'}`}>
                          {meta.title}
                        </span>
                        <span className={`text-sm font-semibold truncate min-w-0 ${isMe ? 'text-white dark:text-slate-900' : 'text-slate-700 dark:text-slate-200'}`}>
                          {w.name}
                        </span>
                        {isMe && (
                          <span className="text-[11px] bg-white/25 dark:bg-slate-900/20 text-white dark:text-slate-900 px-2 py-0.5 rounded-full font-bold shrink-0">
                            나
                          </span>
                        )}
                        <span className={`ml-auto text-sm tabular-nums font-semibold shrink-0 ${isMe ? 'text-white/90 dark:text-slate-900/80' : 'text-slate-500 dark:text-slate-400'}`}>
                          {typeof w.score === 'number' ? w.score.toFixed(1) : '-'}
                        </span>
                      </div>
                      {w.highlight && (
                        <p className={`text-xs mt-1 leading-relaxed line-clamp-2 ${isMe ? 'text-white/80 dark:text-slate-900/80' : 'text-slate-500 dark:text-slate-400'}`}>
                          "{w.highlight}"
                        </p>
                      )}
                      <p className={`text-[10px] mt-1 ${isMe ? 'text-white/60 dark:text-slate-900/60' : 'text-slate-400 dark:text-slate-500'}`}>
                        탭해서 상세 사유 보기
                      </p>
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>

            {/* 아직 안 나온 순위는 잠금 슬롯 */}
            {revealedUpTo < revealOrder.length && revealOrder.slice(revealedUpTo).map((key) => {
              const meta = RANK_META.find(r => r.key === key);
              return (
                <div key={`locked-${key}`} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-dashed border-slate-200 dark:border-slate-600">
                  <div className="w-6 flex items-center justify-center shrink-0">
                    <Lock size={14} className="text-slate-300" />
                  </div>
                  <span className="text-sm text-slate-400">{meta.title} · 공개 대기</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 상세 사유 모달 — 카드 클릭 시 전체 심사평 + 하이라이트 */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {detailWinner && detailMeta && (
            <motion.div
              key="detail-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
              onClick={(e) => { if (e.target === e.currentTarget) setDetailRank(null); }}
            >
              <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                role="dialog"
                aria-modal="true"
                aria-label={`${detailMeta.title} 상세 사유`}
                className="w-full sm:w-[min(92vw,480px)] max-h-[85dvh] overflow-y-auto bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl"
              >
                {/* Header */}
                <div className={`${detailMeta.color} px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-5 text-white relative`}>
                  <button
                    onClick={() => setDetailRank(null)}
                    aria-label="닫기"
                    className="absolute top-3 right-3 p-2 min-h-[40px] min-w-[40px] rounded-lg text-white/80 hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  >
                    <X size={20} />
                  </button>
                  <div className="flex items-center gap-2">
                    <detailMeta.Icon size={20} />
                    <p className="text-sm font-bold">{detailMeta.title}</p>
                  </div>
                  <h3 className="text-2xl font-bold mt-2 break-words">{detailWinner.name}</h3>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-3xl font-bold tabular-nums">
                      {typeof detailWinner.score === 'number' ? detailWinner.score.toFixed(1) : '-'}
                    </span>
                    <span className="text-sm opacity-80">/ 10점</span>
                  </div>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                  {detailWinner.highlight && (
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">한 줄 하이라이트</p>
                      <p className="text-base font-semibold text-slate-900 dark:text-slate-100 leading-relaxed">
                        "{detailWinner.highlight}"
                      </p>
                    </div>
                  )}
                  {detailWinner.comment && (
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        {detailWinner.bestJudgeName || '대표 심사위원'} 심사평
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {detailWinner.comment}
                      </p>
                    </div>
                  )}
                  {!detailWinner.comment && !detailWinner.highlight && (
                    <p className="text-sm text-slate-400 text-center py-4">
                      심사평 정보가 없어요
                    </p>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* 본인 7명 심사평 펼침 모달 — 모든 판사의 점수/하이라이트/코멘트를 정렬해서 보여줌 */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showAllComments && myResult?.judges && (
            <motion.div
              key="all-comments-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
              onClick={(e) => { if (e.target === e.currentTarget) setShowAllComments(false); }}
            >
              <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                role="dialog"
                aria-modal="true"
                aria-label="7명 심사평 전체 보기"
                className="w-full sm:w-[min(92vw,520px)] max-h-[85dvh] overflow-y-auto bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl"
              >
                <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-5 py-4 flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">7명 심사평</h3>
                  <button
                    onClick={() => setShowAllComments(false)}
                    aria-label="닫기"
                    className="p-2 min-h-[40px] min-w-[40px] rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="p-5 space-y-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                  {Object.values(myResult.judges)
                    .filter(j => !j.error)
                    .sort((a, b) => (b.score || 0) - (a.score || 0))
                    .map((j) => {
                      const judge = getJudgeById(j.judgeId);
                      return (
                        <div key={j.judgeId} className="rounded-xl border border-slate-100 dark:border-slate-700 p-4 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: judge?.color || '#94a3b8' }}
                                aria-hidden="true"
                              />
                              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{judge?.name || j.judgeName}</span>
                              <span className="text-[11px] text-slate-400 truncate">· {judge?.role || ''}</span>
                            </div>
                            <span className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums shrink-0">
                              {j.score}<span className="text-[10px] text-slate-400 font-normal"> / 10</span>
                            </span>
                          </div>
                          {j.highlight && (
                            <p className="text-[12px] italic text-slate-500 dark:text-slate-400 leading-relaxed">"{j.highlight}"</p>
                          )}
                          {j.comment && (
                            <p className="text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">{j.comment}</p>
                          )}
                        </div>
                      );
                    })}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
});

/**
 * JudgeBars — 7명 심사위원 점수 가로 막대. 점수 내림차순 정렬.
 * indigo는 design tokens의 "차트 바" 용도와 일치 (§Quick Reference).
 * 점수 0~10이라 막대 width = score*10%.
 */
function JudgeBars({ judges }) {
  const entries = Object.values(judges || {}).filter(j => !j.error);
  if (entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => (b.score || 0) - (a.score || 0));
  return (
    <div className="pt-3 border-t border-slate-100 dark:border-slate-700 space-y-2">
      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        7명 심사위원 점수
      </p>
      <div className="space-y-1.5">
        {sorted.map((j, i) => {
          const judge = getJudgeById(j.judgeId);
          const pct = Math.max(0, Math.min(100, (j.score / 10) * 100));
          return (
            <div key={j.judgeId} className="flex items-center gap-2 text-[11px]">
              {/* 판사별 컬러 dot — judges.js의 color 사용 (캐릭터 식별).
                  막대 자체는 indigo 통일해 §1 "5색 막대" 회피. dot만 캐릭터 표현 역할. */}
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: judge?.color || '#94a3b8' }}
                aria-hidden="true"
              />
              <span className="w-12 text-slate-600 dark:text-slate-300 truncate font-medium">{judge?.name || j.judgeName}</span>
              <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.7, delay: 0.05 * i, ease: [0.2, 0.6, 0.4, 1] }}
                  // 최고점 판사 막대만 amber로 강조 — "가장 높이 평가한 판사" 시각화
                  className={`h-full rounded-full ${i === 0 ? 'bg-amber-500 dark:bg-amber-400' : 'bg-indigo-500 dark:bg-indigo-400'}`}
                />
              </div>
              <span className="w-6 tabular-nums text-slate-700 dark:text-slate-200 font-bold text-right">{j.score}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JudgeComments({ judges }) {
  const entries = Object.values(judges || {}).filter(j => !j.error);
  if (!entries.length) return null;
  const top = entries.sort((a, b) => (b.score || 0) - (a.score || 0))[0];
  const judge = getJudgeById(top.judgeId);
  return (
    <div className="pt-3 border-t border-slate-100 dark:border-slate-700 space-y-1.5">
      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
        {judge?.name || top.judgeName} · {judge?.role}
      </p>
      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">"{top.comment}"</p>
    </div>
  );
}
