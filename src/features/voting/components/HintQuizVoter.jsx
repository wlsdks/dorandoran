import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb } from 'lucide-react';
import TextInput from './TextInput';

/**
 * HintQuizVoter — 학생이 공개된 힌트를 보고 정답을 추측.
 * hints: string[], revealedHints: number (Firebase에서 실시간 동기화)
 */
export default memo(function HintQuizVoter({ sessionId, questionId, hints = [], revealedHints = 0, disabled = false }) {
  const maxHints = Math.min(hints.length, 5);

  return (
    <div className="space-y-4">
      {/* Hint counter */}
      <div className="flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400">
        <Lightbulb size={16} />
        <span className="text-sm font-medium">힌트 {revealedHints}/{maxHints}</span>
      </div>

      {/* Hint cards — 스크롤 가능 (모바일에서 입력 영역 가리지 않게) */}
      {maxHints > 0 && (
        <div className="space-y-2 max-h-[35vh] overflow-y-auto">
          {hints.slice(0, maxHints).map((hint, i) => {
            const isRevealed = i < revealedHints;
            return (
              <AnimatePresence key={i}>
                {isRevealed ? (
                  <motion.div
                    initial={{ opacity: 0, x: -12, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="flex items-start gap-2.5 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm"
                  >
                    <span className="w-6 h-6 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-relaxed">
                      {hint}
                    </p>
                  </motion.div>
                ) : (
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 opacity-50">
                    <span className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 flex items-center justify-center text-xs font-bold shrink-0">
                      {i + 1}
                    </span>
                    <p className="text-sm text-slate-300 dark:text-slate-500">???</p>
                  </div>
                )}
              </AnimatePresence>
            );
          })}
        </div>
      )}

      {/* Text input for answer */}
      <TextInput
        sessionId={sessionId}
        questionId={questionId}
        type="hintQuiz"
        placeholder="정답을 입력하세요"
        maxLength={50}
        disabled={disabled}
      />
    </div>
  );
});
