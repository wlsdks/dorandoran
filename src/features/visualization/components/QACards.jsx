import { useState, memo, useMemo } from 'react';
import { useVotes } from '@/hooks/useVotes';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users } from 'lucide-react';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import Avatar from '@/components/ui/Avatar';

function formatTime(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function DetailModal({ item, onClose }) {
  if (!item) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Avatar name={item.nickname || '익명'} size="sm" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.nickname || '익명'}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{formatTime(item.timestamp)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 transition-colors duration-150">
            <X size={18} />
          </button>
        </div>
        <p className="text-base text-slate-800 dark:text-slate-100 leading-relaxed break-words">{item.value}</p>
      </motion.div>
    </motion.div>
  );
}

export default memo(function QACards({ sessionId, questionId, title }) {
  const { voteList } = useVotes(sessionId, questionId);
  const [selected, setSelected] = useState(null);
  const sorted = useMemo(
    () => [...voteList].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)),
    [voteList]
  );

  return (
    <>
      <div className="w-full max-w-4xl mx-auto">
        {/* Question header */}
        <div className="mb-6">
          {title && <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-tight mb-1">{title}</h2>}
          <div className="flex items-center gap-3 text-sm text-slate-400 dark:text-slate-500">
            <span className="flex items-center gap-1">
              <Users size={14} />
              {sorted.length}명 응답
            </span>
          </div>
        </div>

        {/* Response feed */}
        <div className="space-y-2.5">
          {sorted.map((vote, i) => (
            <motion.button
              key={vote.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, type: 'spring', stiffness: 300, damping: 25 }}
              onClick={() => setSelected(vote)}
              className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3.5 hover:border-slate-300 dark:hover:border-slate-600 transition-colors duration-150 group"
            >
              <div className="flex items-center gap-3">
                <Avatar name={vote.nickname || '익명'} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{vote.nickname || '익명'}</span>
                    <span className="text-xs text-slate-300 dark:text-slate-600">{formatTime(vote.timestamp)}</span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed line-clamp-2">{vote.value}</p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {sorted.length === 0 && (
          <div className="text-center py-20 space-y-3 flex flex-col items-center">
            <DoranDoranMascot size="sm" />
            <div>
              <p className="text-slate-400 dark:text-slate-500 text-sm">아직 응답이 없습니다</p>
              <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">학생들이 답변하면 여기에 표시됩니다</p>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selected && <DetailModal item={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </>
  );
});
