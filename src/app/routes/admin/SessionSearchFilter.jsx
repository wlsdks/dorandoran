import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';

const STATUS_FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'active', label: '진행 중' },
  { key: 'reviewing', label: '질문 받기' },
  { key: 'ended', label: '완료' },
  { key: 'setting', label: '세팅중' },
];

export default function SessionSearchFilter({ searchQuery, onSearchChange, statusFilter, onStatusChange, actionSlot }) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  return (
    <div className="space-y-4">
      {/* Search input + action */}
      <div className="flex items-center gap-3">
      <div className="relative flex-1 min-w-0">
        <Search
          size={16}
          className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-150 ${
            focused ? 'text-slate-600 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'
          }`}
        />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="강의명으로 검색..."
          aria-label="세션 검색"
          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-9 max-sm:pr-12 py-2.5 text-sm placeholder:text-slate-500 dark:placeholder:text-slate-300 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors duration-150"
        />
        <AnimatePresence>
          {searchQuery && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              onClick={() => {
                onSearchChange('');
                inputRef.current?.focus();
              }}
              className="absolute right-3 max-sm:right-0 top-1/2 -translate-y-1/2 p-0.5 max-sm:min-h-11 max-sm:min-w-11 flex items-center justify-center rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-150 active:scale-90"
              aria-label="검색어 지우기"
            >
              <X size={14} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      {actionSlot}
      </div>

      {/* Status filter chips */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.key}
            onClick={() => onStatusChange(filter.key)}
            className={`shrink-0 px-3 py-1 max-sm:min-h-11 text-xs font-medium rounded-lg transition-colors duration-150 active:scale-[0.96] ${
              statusFilter === filter.key
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </div>
  );
}
