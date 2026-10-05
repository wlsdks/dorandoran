import { memo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Zap, X, Plus } from 'lucide-react';
import { modeGroups, modeLabel } from '@/lib/modes';

export default memo(function ModeSwitcher({ currentMode, isSpecialMode, leaderboard, modeOpen, onToggle, onSwitchMode, onAddModeCard }) {
  const containerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!modeOpen) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) onToggle();
    };
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation();
      onToggle();
      containerRef.current?.querySelector('button')?.focus();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', handleEscape, true);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', handleEscape, true);
    };
  }, [modeOpen, onToggle]);

  const groups = modeGroups({ hasLeaderboard: leaderboard.length > 0 });
  const activeLabel = modeLabel(currentMode, { short: true });

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={onToggle}
        aria-expanded={modeOpen}
        className={`min-h-12 inline-flex items-center gap-1.5 text-sm font-medium py-1.5 px-3 rounded-lg whitespace-nowrap transition-colors duration-150 active:scale-[0.97] ${
          isSpecialMode
            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
        }`}
      >
        <Zap size={14} />
        {isSpecialMode ? activeLabel : '모드'}
        <motion.div animate={{ rotate: modeOpen ? 180 : 0 }} transition={{ duration: 0.15 }}>
          <ChevronDown size={12} />
        </motion.div>
      </button>

      <AnimatePresence>
        {modeOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            role="region" aria-label="수업 화면 선택" className="mt-2 w-full min-w-52 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm py-1.5 max-h-[min(420px,60dvh)] overflow-y-auto overscroll-contain"
          >
            {groups.map((group, gi) => (
              <div key={group.label}>
                {gi > 0 && <div className="border-t border-slate-100 dark:border-slate-700 my-1" />}
                <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{group.label}</p>
                {group.items.map(({ mode, label, icon: Icon }) => {
                  const isActive = currentMode === mode;
                  return (
                    <div key={mode} className="flex items-stretch">
                      <button
                        onClick={() => { onSwitchMode(mode); onToggle(); }}
                        className={`min-h-11 flex-1 flex items-center gap-2 px-3 py-2 text-sm transition-colors duration-100 ${
                          isActive
                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium'
                        }`}
                      >
                        <Icon size={15} />
                        {label}
                      </button>
                      {onAddModeCard && (
                        <button
                          onClick={() => { onAddModeCard(mode); onToggle(); }}
                          title="질문 목록에 추가"
                          aria-label={`${label}을(를) 질문 목록에 추가`}
                          className="min-w-11 min-h-11 px-2.5 text-slate-300 dark:text-slate-600 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors duration-100"
                        >
                          <Plus size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {isSpecialMode && (
              <>
                <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
                <button
                  onClick={() => { onSwitchMode('waiting'); onToggle(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-100"
                >
                  <X size={15} />
                  화면 종료
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
