import { useState, useEffect, useRef, useCallback } from 'react';
import { Download, FileSpreadsheet, Users, ChevronDown } from 'lucide-react';
import { exportQuestionSummary, exportParticipantResponses, getFilenamePrefix } from '@/lib/csv';
export default function ExportMenu({
  session,
  participants,
  scores
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);
  const prefix = getFilenamePrefix(session);
  const handleQuestionExport = useCallback(() => {
    exportQuestionSummary(session, participants, `${prefix}_질문결과.csv`);
    setOpen(false);
  }, [session, participants, prefix]);
  const handleParticipantExport = useCallback(() => {
    exportParticipantResponses(session, participants, scores, `${prefix}_참여자응답.csv`);
    setOpen(false);
  }, [session, participants, scores, prefix]);
  return <div className="relative" ref={menuRef}>
      <button onClick={() => setOpen(p => !p)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 text-sm font-medium transition-colors duration-150 active:scale-[0.97]" aria-expanded={open} aria-label="CSV 내보내기">
        <Download size={16} />
        내보내기
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="absolute right-0 top-full mt-1.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg py-1 z-30 w-56">
          <button onClick={handleQuestionExport} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-150 text-left">
            <FileSpreadsheet size={16} className="text-slate-400 shrink-0" />
            <div>
              <p className="font-medium">질문 결과</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">질문별 응답률, 정답률, 분포</p>
            </div>
          </button>
          <button onClick={handleParticipantExport} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-150 text-left">
            <Users size={16} className="text-slate-400 shrink-0" />
            <div>
              <p className="font-medium">참여자별 응답</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">학생별 답변, 점수</p>
            </div>
          </button>
        </div>}
    </div>;
}
