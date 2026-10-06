import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Button from '@/components/ui/Button';
import { renameCourseRecords, deleteCourseRecord } from '@/features/course/api/useCourses';

const ICON_BUTTON = 'p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-150';

/**
 * 강의 이름 바꾸기·삭제. 차수가 남아 있는 강의는 지우지 않는다 — 수업 기록을 실수로 잃지 않게
 * 차수를 먼저 정리하도록 안내한다.
 */
export default function CourseActions({ courseId, name, sessions = [] }) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleRename(e) {
    e.preventDefault();
    if (!draft.trim() || draft.trim() === name) { setRenaming(false); return; }
    setBusy(true); setError(null);
    try {
      await renameCourseRecords(courseId, draft, { oldName: name, sessionIds: sessions.map((s) => s.id) });
      setRenaming(false);
    } catch (err) {
      setError(err.message || '이름을 바꾸지 못했어요.');
    } finally { setBusy(false); }
  }

  async function handleDelete() {
    setBusy(true); setError(null);
    try { await deleteCourseRecord(courseId); setConfirmDelete(false); }
    catch (err) { setError(err.message || '강의를 삭제하지 못했어요.'); }
    finally { setBusy(false); }
  }

  const hasSessions = sessions.length > 0;
  return (
    <>
      <button type="button" onClick={() => { setDraft(name); setError(null); setRenaming(true); }} className={ICON_BUTTON} aria-label={`${name} 이름 바꾸기`}>
        <Pencil size={16} />
      </button>
      <button type="button" onClick={() => { setError(null); setConfirmDelete(true); }} className={ICON_BUTTON} aria-label={`${name} 강의 삭제`}>
        <Trash2 size={16} />
      </button>

      <Modal open={renaming} onClose={() => setRenaming(false)} ariaLabel="강의 이름 바꾸기" size="sm">
        <form onSubmit={handleRename} className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">강의 이름 바꾸기</h2>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={100} autoFocus aria-label="강의 이름"
            className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3 text-base text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
          <p className="text-xs text-slate-500 dark:text-slate-400">이 강의의 차수와 과제에 표시되는 이름도 함께 바뀌어요.</p>
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setRenaming(false)}>취소</Button>
            <Button type="submit" className="flex-[2]" disabled={busy || !draft.trim()}>{busy ? '저장 중...' : '저장'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={hasSessions ? () => setConfirmDelete(false) : handleDelete}
        title={hasSessions ? '차수가 남아 있어요' : `"${name}" 강의를 삭제할까요?`}
        description={hasSessions
          ? `이 강의에 차수 ${sessions.length}개가 있어요. 수업 기록을 지키기 위해 차수를 먼저 삭제한 뒤 강의를 삭제할 수 있어요.`
          : '강의와 스태프 배정이 삭제돼요. 되돌릴 수 없어요.'}
        confirmLabel={hasSessions ? '확인' : busy ? '삭제 중...' : '삭제'}
        variant={hasSessions ? 'primary' : 'danger'}
      >
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </ConfirmModal>
    </>
  );
}
