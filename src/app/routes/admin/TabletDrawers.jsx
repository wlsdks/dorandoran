import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { fadeIn, sheet, ease } from '@/lib/motion';

// 서랍: 시트와 같은 스프링으로 들어오고(튀지 않음), 나갈 땐 들어온 쪽으로 짧게 미끄러진다.
const drawerSpring = sheet;
const drawerExit = { duration: 0.16, ease: ease.in };

export default function TabletDrawers({
  leftOpen,
  rightOpen,
  onCloseLeft,
  onCloseRight,
  leftContent,
  rightContent,
}) {
  return (
    <>
      {/* Left drawer (질문 목록) */}
      <AnimatePresence>
        {leftOpen && (
          <>
            <motion.div
              {...fadeIn}
              className="fixed inset-0 bg-black/30 z-40"
              onClick={onCloseLeft}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%', transition: drawerExit }}
              transition={drawerSpring}
              className="fixed inset-y-0 left-0 z-50 w-[340px] max-w-[85vw] bg-white dark:bg-slate-800 shadow-xl overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-700 shrink-0">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">질문 관리</span>
                <button
                  onClick={onCloseLeft}
                  className="p-2 -mr-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-150 active:scale-90"
                  aria-label="닫기"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 p-4 overflow-y-auto overscroll-contain scrollbar-hide">
                {leftContent}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Right drawer (참여자/상호작용) */}
      <AnimatePresence>
        {rightOpen && (
          <>
            <motion.div
              {...fadeIn}
              className="fixed inset-0 bg-black/30 z-40"
              onClick={onCloseRight}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%', transition: drawerExit }}
              transition={drawerSpring}
              className="fixed inset-y-0 right-0 z-50 w-[340px] max-w-[85vw] bg-white dark:bg-slate-800 shadow-xl overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-700 shrink-0">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">참여자 · 상호작용</span>
                <button
                  onClick={onCloseRight}
                  className="p-2 -mr-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-150 active:scale-90"
                  aria-label="닫기"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 p-4 space-y-3 overflow-y-auto overscroll-contain scrollbar-hide">
                {rightContent}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
