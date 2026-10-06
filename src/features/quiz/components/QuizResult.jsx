import { motion, useReducedMotion } from 'framer-motion';
import { lazy, Suspense } from 'react';
import { Check, X, Flame, ChevronDown } from 'lucide-react';
import AnimatedNumber from '@/components/ui/AnimatedNumber';
const ConfettiBurst = lazy(() => import('@/components/ui/ConfettiBurst'));

export default function QuizResult({ isCorrect, points, correctAnswer, correctImage = null, correctLetter = null, bet = 1, streak = 0, scoreApplied = true, scoreDetails }) {
  const reduced = useReducedMotion();
  const signed = points > 0 ? '+' : points < 0 ? '−' : '';
  return <motion.div initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : 0.18 }}
    className="w-full rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 p-5 shadow-sm overflow-hidden relative" aria-label="이번 퀴즈 결과">
    {isCorrect && scoreApplied && !reduced && <Suspense fallback={null}><ConfettiBurst /></Suspense>}
    <div className="relative z-[1] space-y-4">
      <div className="flex items-center gap-3">
        <span className={`shrink-0 ${isCorrect ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-400 dark:text-slate-500'}`} aria-hidden="true">{isCorrect ? <Check size={36} strokeWidth={2.5} /> : <X size={36} strokeWidth={2.5} />}</span>
        <div><p className="text-xl font-bold text-slate-900 dark:text-slate-100">{isCorrect ? '정답!' : '오답'}</p><p className="text-sm text-slate-500 dark:text-slate-300">{isCorrect ? '잘 하셨어요!' : '다음 문제에 다시 도전해보세요'}</p></div>
      </div>
      {/* 정답 칸은 공개 순간 answer-glow로 한 번 빛나고 테두리 빛이 남는다 — 맞았든 틀렸든 정답이 먼저 눈에 들어온다 */}
      {correctAnswer && <div className="answer-glow rounded-xl bg-slate-50 dark:bg-slate-700/50 px-4 py-3 [word-break:keep-all] [overflow-wrap:anywhere]"><p className="text-xs text-slate-500 dark:text-slate-300 mb-1">정답</p>{correctImage
        ? <div className="flex items-center gap-3"><img src={correctImage} alt={`정답 ${correctLetter || ''} 사진`} className="h-20 w-20 shrink-0 rounded-lg object-contain bg-slate-100 dark:bg-slate-900" /><p className="text-base font-semibold text-slate-900 dark:text-slate-100">{correctLetter}{correctLetter && !/^사진 [A-Z]$/.test(correctAnswer) ? `. ${correctAnswer}` : ''}{!correctLetter && correctAnswer}</p></div>
        : <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{correctAnswer}</p>}</div>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-medium text-slate-500 dark:text-slate-300">이번 퀴즈 점수</p><p className={`mt-1 text-3xl font-bold tabular-nums ${points < 0 ? 'text-red-600 dark:text-red-300' : 'text-slate-900 dark:text-slate-100'}`}>
          {scoreApplied ? <>{signed}<AnimatedNumber value={Math.abs(points)} />점</> : <span className="text-base font-medium">반영 확인 중</span>}
        </p></div>
        <div className="flex flex-wrap gap-2">
          {bet > 1 && <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-200">{bet}배 베팅</span>}
          {isCorrect && streak >= 3 && <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300"><Flame size={14} />{streak}연속 정답</span>}
        </div>
      </div>
      {scoreDetails && <details className="group border-t border-slate-100 dark:border-slate-700">
        <summary className="flex min-h-11 items-center justify-between gap-2 cursor-pointer list-none text-sm font-medium text-slate-600 dark:text-slate-300 [&::-webkit-details-marker]:hidden">점수가 계산된 이유<ChevronDown size={16} className="group-open:rotate-180" /></summary>
        <div className="pb-1">{scoreDetails}</div>
      </details>}
    </div>
  </motion.div>;
}
