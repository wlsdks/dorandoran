import { motion } from 'framer-motion';
import { stepForward } from '@/lib/motion';
import Button from '@/components/ui/Button';

export default function CreateSessionStepNewCourse({ value, onChange, onBack, onSubmit }) {
  return (
    <motion.div
      key="new-course"
      {...stepForward}
      className="space-y-5"
    >
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">새 강의</h2>
        <p className="text-slate-400 text-sm mt-1">강의 이름을 입력하세요</p>
      </div>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && onSubmit()}
        placeholder="예: 바이브 코딩 기초편"
        aria-label="강의 이름"
        className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3 text-base dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
        autoFocus
      />

      <div className="flex gap-2">
        <Button onClick={onBack} variant="secondary" size="md" className="flex-1">
          뒤로
        </Button>
        <Button
          onClick={onSubmit}
          variant="primary"
          size="md"
          className="flex-1"
          disabled={!value.trim()}
        >
          다음
        </Button>
      </div>
    </motion.div>
  );
}
