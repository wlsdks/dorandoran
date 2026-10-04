import { useAIAvailability } from '@/hooks/useAIAvailability';
import { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { useAssignmentActions } from '@/features/assignments/api/useAssignments';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

function CreateAssignmentContent({ sessions, onClose }) {
  const { configured, reason } = useAIAvailability();
  const { createAssignment } = useAssignmentActions();
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedRound, setSelectedRound] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hasJudging, setHasJudging] = useState(false);
  const [passThreshold, setPassThreshold] = useState(3);
  const [creating, setCreating] = useState(false);

  const courseNames = useMemo(() => {
    const names = new Set();
    sessions.forEach(s => { if (s.courseName) names.add(s.courseName); });
    return [...names].sort();
  }, [sessions]);

  const rounds = useMemo(() => {
    if (!selectedCourse) return [];
    return sessions
      .filter(s => s.courseName === selectedCourse && s.roundNumber)
      .map(s => s.roundNumber)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .sort((a, b) => a - b);
  }, [sessions, selectedCourse]);

  const canCreate = title.trim() && selectedCourse;

  async function handleCreate() {
    if (!canCreate) return;
    setCreating(true);
    try {
      await createAssignment(selectedCourse, {
        title: title.trim(),
        description: description.trim(),
        roundNumber: selectedRound ? Number(selectedRound) : null,
        hasJudging: configured && hasJudging,
        passThreshold,
      });
      onClose();
    } catch {
      alert('과제 생성에 실패했습니다');
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">과제 등록</h3>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          <X size={18} />
        </button>
      </div>

      <div className="space-y-4">
        {/* 클래스 + 차수 — 한 줄 */}
        <div className="flex gap-3">
          <div className="flex-1">
            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mb-2">클래스</p>
            <select
              aria-label="클래스"
              value={selectedCourse}
              onChange={(e) => { setSelectedCourse(e.target.value); setSelectedRound(''); }}
              className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-[15px] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
            >
              <option value="">선택</option>
              {courseNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          {rounds.length > 0 && (
            <div className="w-24">
              <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mb-2">차수</p>
              <select
                aria-label="차수"
                value={selectedRound}
                onChange={(e) => setSelectedRound(e.target.value)}
                className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-[15px] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
              >
                <option value="">전체</option>
                {rounds.map(r => (
                  <option key={r} value={r}>{r}차</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 과제 제목 */}
        <div>
          <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mb-2">과제 제목</p>
          <input
            aria-label="과제 제목"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="과제 제목을 입력하세요"
            maxLength={50}
            autoFocus
            className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-[15px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>

        {/* 과제 설명 */}
        <div>
          <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mb-2">
            과제 설명
            <span className="text-slate-500 dark:text-slate-400 ml-1.5 font-normal">선택</span>
          </p>
          <textarea
            aria-label="과제 설명"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="학생들에게 보여줄 과제 설명"
            rows={2}
            maxLength={300}
            className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-[15px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-all"
          />
        </div>

        {/* AI 심사 토글 */}
        <button
          type="button"
          onClick={() => setHasJudging(!hasJudging)}
          disabled={!configured}
          aria-pressed={configured && hasJudging}
          className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        >
          <div>
            <p className="text-[15px] font-medium text-slate-900 dark:text-slate-100 text-left">AI 심사</p>
            <p className="text-xs text-slate-400 mt-0.5 text-left">{configured ? '7명의 AI 심사위원이 제출물을 평가합니다' : reason}</p>
          </div>
          <div className={`w-11 h-6 rounded-full p-0.5 transition-colors ${configured && hasJudging ? 'bg-slate-900 dark:bg-slate-100' : 'bg-slate-200 dark:bg-slate-600'}`}>
            <div className={`w-5 h-5 rounded-full bg-white dark:bg-slate-900 shadow-sm transition-transform ${configured && hasJudging ? 'translate-x-5' : 'translate-x-0'}`} />
          </div>
        </button>

        {/* 통과 기준 — AI 심사 켰을 때만 */}
        {configured && hasJudging && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-medium text-slate-900 dark:text-slate-100">합격 기준</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 tabular-nums">
                심사위원 <span className="text-slate-900 dark:text-slate-100 font-semibold">{passThreshold}명</span> 이상 추천
              </p>
            </div>
            <input
              type="range"
              min={1}
              max={7}
              step={1}
              value={passThreshold}
              onChange={(e) => setPassThreshold(Number(e.target.value))}
              className="w-full accent-slate-900 dark:accent-slate-100"
            />
            <div className="flex justify-between text-[10px] text-slate-300 dark:text-slate-500 px-0.5">
              {[1,2,3,4,5,6,7].map(n => <span key={n}>{n}</span>)}
            </div>
            <p className="text-xs text-slate-400">심사 후에도 변경 가능합니다</p>
          </div>
        )}

        {/* 생성 버튼 */}
        <div className="flex gap-2 pt-1">
          <Button onClick={onClose} variant="ghost" size="md" className="flex-1">취소</Button>
          <Button onClick={handleCreate} variant="primary" size="md" disabled={!canCreate || creating} className="flex-1">
            {creating ? '생성 중...' : '과제 생성'}
          </Button>
        </div>
      </div>
    </>
  );
}

export default function CreateAssignmentModal({ open, onClose, sessions }) {
  return (
    <Modal open={open} onClose={onClose} ariaLabel="과제 등록">
      <CreateAssignmentContent sessions={sessions} onClose={onClose} />
    </Modal>
  );
}
