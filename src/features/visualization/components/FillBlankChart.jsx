import { useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { useVotes } from '@/hooks/useVotes';
import { normalizeAnswer } from '@/lib/utils';
import AnswerDistribution from './AnswerDistribution';

/** Renders the sentence with the blank highlighted. */
function SentenceDisplay({ title, correctAnswer, revealed, presenter }) {
  const parts = title.split('___');
  return (
    <h2 className={`${presenter ? 'classroom-question-title' : 'preview-question-title'} fillblank-sentence font-bold text-slate-900 dark:text-slate-100 leading-snug text-center`}>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.2 }}
              // 밑줄(border-b) 대신 둥근 칩 하나로 빈칸을 표시한다 — 공개 전은 점선 테두리, 공개 후는 인디고 틴트.
              className={`inline-block mx-1 px-[0.45em] py-[0.05em] rounded-[0.35em] font-bold tracking-tight align-baseline ${
                revealed
                  ? 'bg-indigo-500/15 text-slate-900 ring-1 ring-indigo-400/60 dark:text-slate-50'
                  : 'text-slate-400 dark:text-slate-500 outline-dashed outline-2 -outline-offset-2 outline-slate-300 dark:outline-slate-600'
              }`}
            >
              {revealed ? correctAnswer : '빈칸'}
            </motion.span>
          )}
        </span>
      ))}
    </h2>
  );
}

export default memo(function FillBlankChart({ sessionId, questionId, title, correctAnswer, revealed = false, presenter = false }) {
  const { voteList, totalVotes } = useVotes(sessionId, questionId);

  const { correctCount, topAnswers } = useMemo(() => {
    // Map: normalized(대소문자·띄어쓰기 무시) → { display (first-seen), count }
    const groupMap = new Map();
    let correct = 0;
    const normalizedCorrect = normalizeAnswer(correctAnswer);

    voteList.forEach((v) => {
      const raw = (v.value || '').trim();
      if (!raw) return;
      const normalized = normalizeAnswer(raw);
      const existing = groupMap.get(normalized);
      if (existing) {
        existing.count++;
      } else {
        groupMap.set(normalized, { display: raw, count: 1 });
      }
      if (normalizedCorrect && normalized === normalizedCorrect) correct++;
    });

    const sorted = Array.from(groupMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([normalized, { display, count }]) => ({
        answer: display,
        count,
        isCorrect: normalizedCorrect && normalized === normalizedCorrect,
      }));

    return { correctCount: correct, topAnswers: sorted };
  }, [voteList, correctAnswer]);

  const correctPct = totalVotes > 0 ? Math.round((correctCount / totalVotes) * 100) : 0;

  return (
    <div className="space-y-6 w-full max-w-xl mx-auto px-8">
      {/* Sentence with blank */}
      <SentenceDisplay title={title} correctAnswer={correctAnswer} revealed={revealed} presenter={presenter} />

      {/* Accuracy hero stat */}
      {revealed && correctAnswer && totalVotes > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="text-center space-y-2"
        >
          <motion.p
            key={correctCount}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            className="text-5xl font-black text-slate-900 dark:text-slate-100 tabular-nums"
          >
            {correctPct}%
          </motion.p>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            정답률 ({correctCount}/{totalVotes}명)
          </p>
        </motion.div>
      )}

      {/* 발표 화면은 공개 전 학생 답을 보여주지 않는다 — 아직 답하지 않은 학생이 따라 쓸 수 있다(단답식과 같은 규칙) */}
      {presenter && !revealed && (
        <div className="text-center">
          <p className="text-6xl font-black text-slate-900 dark:text-slate-100 tabular-nums">{totalVotes}명</p>
          <p className="text-xl text-slate-500 dark:text-slate-300 mt-2">응답 완료 · 정답은 잠시 후 공개합니다</p>
        </div>
      )}

      {/* Answer frequency bars */}
      {topAnswers.length > 0 && (revealed || !presenter) && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="space-y-2"
        >
          <AnswerDistribution answers={topAnswers} revealed={revealed} presenter={presenter} />
        </motion.div>
      )}

      {/* Total */}
      {/* 구분선 없이 여백만 — 발표 화면은 하단 바가 응답 수를 이미 보여준다 */}
      {!presenter && <div className="text-center text-slate-400 dark:text-slate-500 text-sm pt-2">
        <span className="text-slate-600 dark:text-slate-300 font-semibold">{totalVotes}</span>명 응답
      </div>}
    </div>
  );
});
