import { Check } from 'lucide-react';
import { motion } from 'framer-motion';

/** 라벨을 막대 밖에 두어 막대의 밝기와 무관하게 읽을 수 있게 한다. */
export default function AnswerDistribution({ answers, revealed = false, presenter = false }) {
  const max = Math.max(1, ...answers.map(answer => answer.count));
  const limit = presenter ? 4 : 10;
  return <div className="answer-distribution space-y-4">
    {answers.slice(0, limit).map(answer => <div key={answer.answer} className={`answer-distribution-row ${revealed && answer.isCorrect ? 'answer-glow' : revealed ? 'answer-dim' : ''}`}>
      <div className="answer-distribution-label flex items-start justify-between gap-4 mb-2 text-slate-700 dark:text-slate-100">
        <span className="min-w-0 break-words">{answer.answer}{revealed && answer.isCorrect && <span className="answer-distribution-correct"><Check size={18} />정답</span>}</span>
        <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-300">{answer.count}명</span>
      </div>
      <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <motion.div initial={false} animate={{ scaleX: answer.count / max }} transition={{ type: 'spring', stiffness: 150, damping: 26 }} className={`h-full w-full origin-left rounded-full ${revealed && answer.isCorrect ? 'bg-indigo-500' : revealed ? 'bg-slate-400 dark:bg-slate-500' : 'bg-indigo-400'}`} />
      </div>
    </div>)}
    {answers.length > limit && <p className="text-sm text-slate-500 dark:text-slate-300">응답이 많은 {limit}개 표시 · 그 외 {answers.length - limit}개</p>}
  </div>;
}
