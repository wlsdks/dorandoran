import { memo } from 'react';
import { motion } from 'framer-motion';
import { useVotes } from '@/hooks/useVotes';
import { Check } from 'lucide-react';
import AnimatedNumber from '@/components/ui/AnimatedNumber';
import { grow, spring } from '@/lib/motion';

export default memo(function OXBattle({ sessionId, questionId, correctValue = null, revealed = false }) {
  const { totalVotes, countByValue } = useVotes(sessionId, questionId);
  const oCount = countByValue('O');
  const xCount = countByValue('X');
  // O/X로 읽힌 응답만 분모로 쓴다. 응답이 없으면 막대를 비워 두고(50:50으로 보이지 않게),
  // 반올림 합이 100%를 넘지 않게 X는 나머지로 계산한다.
  const sideTotal = oCount + xCount;
  const oPct = sideTotal > 0 ? Math.round((oCount / sideTotal) * 100) : 0;
  const xPct = sideTotal > 0 ? 100 - oPct : 0;
  const oWinning = oCount > xCount;
  const xWinning = xCount > oCount;
  const oCorrect = revealed && correctValue === 'O';
  const xCorrect = revealed && correctValue === 'X';

  return (
    <div className="w-full max-w-xl mx-auto space-y-10">
      {/* Split display */}
      <div className="flex items-center justify-between text-center gap-2">
        {/* 정답 쪽은 answer-glow(공개 순간 빛 + 테두리 빛), 반대쪽은 answer-dim으로 가라앉힌다 */}
        <div className={`flex-1 space-y-3 py-8 rounded-2xl transition-[opacity,background-color] duration-300 ${oCorrect ? 'answer-glow bg-indigo-500/10 dark:bg-indigo-400/10' : revealed && correctValue ? 'answer-dim' : ''}`}>
          <div className="relative inline-block">
            {/* key 제거 — 득표 변할 때마다 거대 숫자/글자 remount+spring 재시작하던 렉 방지 (텍스트는 그대로 갱신됨) */}
            <div
              className={`text-7xl font-black transition-colors duration-300 ${
                revealed
                  ? oCorrect ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-600'
                  : oWinning ? 'text-indigo-600 dark:text-indigo-400' : 'text-indigo-400 dark:text-indigo-500'
              }`}
            >
              O
            </div>
            {oCorrect && (
              <motion.span
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ ...spring.stiff, delay: 0.1 }}
                className="absolute -top-1 -right-3 flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
              >
                <Check size={14} strokeWidth={3} />
              </motion.span>
            )}
          </div>
          <div
            className={`text-3xl font-bold tracking-tight tabular-nums ${oCorrect ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-900 dark:text-slate-100'}`}
          >
            <AnimatedNumber value={oCount} /><span className="ml-0.5 text-base font-medium text-slate-400 dark:text-slate-500">명</span>
          </div>
        </div>

        <div className="px-4">
          <div className="text-slate-400 dark:text-slate-500 text-2xl font-bold">VS</div>
        </div>

        <div className={`flex-1 space-y-3 py-8 rounded-2xl transition-[opacity,background-color] duration-300 ${xCorrect ? 'answer-glow bg-indigo-500/10 dark:bg-indigo-400/10' : revealed && correctValue ? 'answer-dim' : ''}`}>
          <div className="relative inline-block">
            <div
              className={`text-7xl font-black transition-colors duration-300 ${
                revealed
                  ? xCorrect ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600'
                  : xWinning ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              X
            </div>
            {xCorrect && (
              <motion.span
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ ...spring.stiff, delay: 0.1 }}
                className="absolute -top-1 -right-3 flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
              >
                <Check size={14} strokeWidth={3} />
              </motion.span>
            )}
          </div>
          <div
            className={`text-3xl font-bold tracking-tight tabular-nums ${xCorrect ? 'text-slate-800 dark:text-slate-200' : 'text-slate-900 dark:text-slate-100'}`}
          >
            <AnimatedNumber value={xCount} /><span className="ml-0.5 text-base font-medium text-slate-400 dark:text-slate-500">명</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-2.5">
        {/* 양쪽 막대는 width 대신 scaleX — 왼쪽은 왼끝에서, 오른쪽은 오른끝에서 자란다 */}
        <div className="relative h-8 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <motion.div
            initial={false}
            animate={{ scaleX: oPct / 100 }}
            transition={grow}
            className="absolute inset-0 origin-left bg-indigo-500 rounded-l-full"
          />
          <motion.div
            initial={false}
            animate={{ scaleX: xPct / 100 }}
            transition={grow}
            className="absolute inset-0 origin-right bg-slate-400 rounded-r-full"
          />
        </div>
        <div className="flex justify-between text-base font-bold">
          <span className="text-indigo-600 dark:text-indigo-400"><AnimatedNumber value={oPct} />%</span>
          <span className="text-slate-400 dark:text-slate-500 text-sm">총 <AnimatedNumber value={totalVotes} />명</span>
          <span className="text-slate-600 dark:text-slate-300"><AnimatedNumber value={xPct} />%</span>
        </div>
      </div>
    </div>
  );
});
