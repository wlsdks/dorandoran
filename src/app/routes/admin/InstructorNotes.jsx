/* eslint-disable react-refresh/only-export-components -- useNotesState hook과 InstructorNotes 컴포넌트 의도적 collocation */
import { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StickyNote, Plus, Check, X } from 'lucide-react';

/**
 * InstructorNotes — 강사 실습 중 할 말 메모.
 * localStorage에 저장 (세션별).
 * 읽은 메모는 자동으로 아래로 이동 + 흐리게.
 */

const NOTES_CHANGED_EVENT = 'dorandoran-notes-changed';
function getNotesKey(sessionId) { return `dorandoran_notes_${sessionId}`; }

function loadNotes(sessionId) {
  try {
    return JSON.parse(localStorage.getItem(getNotesKey(sessionId)) || '[]');
  } catch { return []; }
}

function saveNotes(sessionId, notes) {
  localStorage.setItem(getNotesKey(sessionId), JSON.stringify(notes));
  // 다른 useNotesState 구독자(예: InstructorCommHub 배지)에 즉시 반영
  window.dispatchEvent(new CustomEvent(NOTES_CHANGED_EVENT, { detail: { sessionId } }));
}

const NoteItem = memo(function NoteItem({ note, onToggle, onDelete }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: note.done ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`flex items-start gap-3 py-3 ${note.done ? '' : ''}`}
    >
      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={() => onToggle(note.id)}
        className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors duration-150 ${
          note.done
            ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100'
            : 'border-slate-300 dark:border-slate-600'
        }`}
      >
        {note.done && <Check size={12} className="text-white dark:text-slate-900" />}
      </motion.button>
      <p className={`flex-1 text-[15px] leading-relaxed ${note.done ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>
        {note.text}
      </p>
      <button onClick={() => onDelete(note.id)}
        className="p-1 rounded text-slate-300 hover:text-slate-500 dark:hover:text-slate-400 transition-colors duration-150 shrink-0 mt-0.5">
        <X size={14} />
      </button>
    </motion.div>
  );
});

// unread/read 개수 외부에서 미리 미리보기 배지에 쓸 수 있도록 훅 분리.
// localStorage는 React state와 독립이라 NOTES_CHANGED_EVENT와 storage 이벤트를 구독해
// InstructorNotes 저장 시 동일 sessionId 구독자가 자동 갱신.
export function useNotesState(sessionId) {
  const [notes, setNotes] = useState(() => loadNotes(sessionId));
  useEffect(() => {
    if (!sessionId) return;
    const handler = (e) => {
      if (e.detail?.sessionId === sessionId) setNotes(loadNotes(sessionId));
    };
    const storageHandler = (e) => {
      if (e.key === getNotesKey(sessionId)) setNotes(loadNotes(sessionId));
    };
    window.addEventListener(NOTES_CHANGED_EVENT, handler);
    window.addEventListener('storage', storageHandler);
    return () => {
      window.removeEventListener(NOTES_CHANGED_EVENT, handler);
      window.removeEventListener('storage', storageHandler);
    };
  }, [sessionId]);
  const unreadCount = notes.filter((n) => !n.done).length;
  return { notes, setNotes, unreadCount };
}

export default function InstructorNotes({ sessionId, embedded = false }) {
  const [notes, setNotes] = useState(() => loadNotes(sessionId));
  const [input, setInput] = useState('');
  const [expanded, setExpanded] = useState(true);

  const update = useCallback((next) => {
    setNotes(next);
    saveNotes(sessionId, next);
  }, [sessionId]);

  function handleAdd(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text) return;
    const next = [{ id: Date.now().toString(), text, done: false }, ...notes];
    update(next);
    setInput('');
  }

  const handleToggle = useCallback((id) => {
    update(notes.map((n) => n.id === id ? { ...n, done: !n.done } : n));
  }, [notes, update]);

  const handleDelete = useCallback((id) => {
    update(notes.filter((n) => n.id !== id));
  }, [notes, update]);

  const unread = notes.filter((n) => !n.done);
  const read = notes.filter((n) => n.done);

  const body = (
    <div className={embedded ? 'space-y-3' : 'px-4 pt-1 pb-4 space-y-3'}>
      {/* Add input */}
      <form onSubmit={handleAdd} className="relative">
        <input
          aria-label="강사 노트 추가"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="실습 중 할 말을 적어두세요"
          className="w-full bg-slate-50 dark:bg-slate-700 rounded-xl px-4 py-3 pr-12 text-[15px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-600 transition-colors duration-150"
        />
        <motion.button
          whileTap={{ scale: 0.85 }}
          type="submit"
          disabled={!input.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 disabled:opacity-20 flex items-center justify-center transition-opacity duration-150"
        >
          <Plus size={14} />
        </motion.button>
      </form>

      {/* Notes list */}
      {notes.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-3">실습 중 할 말을 메모해두세요</p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          <AnimatePresence>
            {unread.map((n) => <NoteItem key={n.id} note={n} onToggle={handleToggle} onDelete={handleDelete} />)}
            {read.map((n) => <NoteItem key={n.id} note={n} onToggle={handleToggle} onDelete={handleDelete} />)}
          </AnimatePresence>
        </div>
      )}
    </div>
  );

  if (embedded) return body;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-150"
      >
        <div className="flex items-center gap-2">
          <StickyNote size={14} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            메모
          </span>
          {unread.length > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center">
              {unread.length}
            </span>
          )}
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </motion.div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {body}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
