import { useState, memo } from 'react';
import { motion } from 'framer-motion';

const LEVELS = [
  { key: 'low', label: '확신 없음' },
  { key: 'medium', label: '보통' },
  { key: 'high', label: '확신' },
];

export default memo(function ConfidenceMeter({ onConfirm }) {
  const [selected, setSelected] = useState(null);

  function handleSelect(level) {
    if (selected) return;
    setSelected(level);
    setTimeout(() => onConfirm(level), 300);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 scroll-mt-4"
      onAnimationComplete={() => {
        // Auto-scroll into view when confidence meter appears
        document.querySelector('[data-confidence-meter]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }}
      data-confidence-meter
    >
      <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-1 font-medium">얼마나 확신하나요?</p>
      <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center mb-3">확신도에 따라 보너스 점수가 달라집니다</p>
      <div className="grid grid-cols-3 gap-2">
        {LEVELS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleSelect(key)}
            disabled={selected !== null}
            className={`min-h-12 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
              selected === key
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'
            } ${selected !== null && selected !== key ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>
    </motion.div>
  );
});
