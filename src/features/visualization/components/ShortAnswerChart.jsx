import { useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { useVotes } from '@/hooks/useVotes';
import { normalizeAnswer } from '@/lib/utils';
import AnswerDistribution from './AnswerDistribution';

/** 정답을 글자수만큼 ○로 마스킹(공백=단어 구분). "블렌디드 러닝" → ○○○○  ○○ */
function MaskedAnswer({ answer }) {
  const words = (answer || '').trim().split(/\s+/).filter(Boolean);
  return (
    <div className="flex items-center justify-center gap-x-6 gap-y-2 flex-wrap">
      {words.map((w, i) => (
        <span key={i} className="text-4xl md:text-5xl font-black text-slate-400 dark:text-slate-500 tracking-[0.25em] select-none">
          {'○'.repeat(Array.from(w).length)}
        </span>
      ))}
    </div>
  );
}

/**
 * 단답식(shortAnswer) 전자칠판 — 정답 공개 전엔 글자수만 ○로 노출(답 숨김),
 * 공개 후엔 실제 정답 + 정답률 + 답변 분포. 빈칸채우기와 달리 문장 속 빈칸이 아니라 독립 답.
 */
export default memo(function ShortAnswerChart({ sessionId, questionId, correctAnswer, revealed = false, presenter = false }) {
  const { voteList, totalVotes } = useVotes(sessionId, questionId);
  const charCount = Array.from((correctAnswer || '').replace(/\s/g, '')).length;

  const { correctCount, topAnswers } = useMemo(() => {
    const groupMap = new Map();
    let correct = 0;
    const normalizedCorrect = normalizeAnswer(correctAnswer);
    voteList.forEach((v) => {
      const raw = (v.value || '').trim();
      if (!raw) return;
      const normalized = normalizeAnswer(raw);
      const existing = groupMap.get(normalized);
      if (existing) existing.count++;
      else groupMap.set(normalized, { display: raw, count: 1 });
      if (normalizedCorrect && normalized === normalizedCorrect) correct++;
    });
    const sorted = Array.from(groupMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([normalized, { display, count }]) => ({
        answer: display, count, isCorrect: normalizedCorrect && normalized === normalizedCorrect,
      }));
    return { correctCount: correct, topAnswers: sorted };
  }, [voteList, correctAnswer]);

  const correctPct = totalVotes > 0 ? Math.round((correctCount / totalVotes) * 100) : 0;

  return (
    <div className="space-y-8 w-full max-w-xl mx-auto px-8">
      {/* 정답 박스 — 공개 전 마스킹 / 공개 후 실제 정답 */}
      <div className="text-center space-y-3">
        <div className="min-h-[72px] flex items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-600 px-6 py-5">
          {revealed ? (
            <motion.p
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              className="text-4xl md:text-5xl font-black text-slate-900 dark:text-slate-100 tracking-tight break-keep"
            >
              {correctAnswer}
            </motion.p>
          ) : (
            correctAnswer ? <MaskedAnswer answer={correctAnswer} /> : <p className="text-xl text-slate-500 dark:text-slate-300">휴대폰에서 답을 입력해주세요<br /><span className="text-base">정답은 잠시 후 공개합니다</span></p>
          )}
        </div>
        {charCount > 0 && (
          <p className="text-sm text-slate-400 dark:text-slate-500">
            {revealed ? '정답' : `${charCount}글자`}
          </p>
        )}
      </div>

      {/* 공개 전: 응답 수만(답변 내용 숨김) / 공개 후: 정답률 + 분포 */}
      {!revealed ? (
        <div className="text-center">
          <motion.p
            key={totalVotes} initial={{ scale: 1.15 }} animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            className="text-5xl font-black text-slate-900 dark:text-slate-100 tabular-nums"
          >
            {totalVotes}
          </motion.p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">명 응답 완료</p>
        </div>
      ) : (
        <>
          {correctAnswer && totalVotes > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="text-center space-y-1"
            >
              <p className="text-5xl font-black text-slate-900 dark:text-slate-100 tabular-nums">{correctPct}%</p>
              <p className="text-sm text-slate-400 dark:text-slate-500">정답률 ({correctCount}/{totalVotes}명)</p>
            </motion.div>
          )}

          {topAnswers.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="space-y-2">
              <AnswerDistribution answers={topAnswers} revealed={revealed} presenter={presenter} />
            </motion.div>
          )}
        </>
      )}

      <div className="text-center text-slate-400 dark:text-slate-500 text-sm pt-2 border-t border-slate-100 dark:border-slate-700">
        <span className="text-slate-600 dark:text-slate-300 font-semibold">{totalVotes}</span>명 응답
      </div>
    </div>
  );
});
