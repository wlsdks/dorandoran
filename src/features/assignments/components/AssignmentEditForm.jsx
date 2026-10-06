import { useState } from 'react';
import Button from '@/components/ui/Button';

const INPUT = 'w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500';

/** 과제 제목·설명 수정. 제출물은 건드리지 않는다. */
export default function AssignmentEditForm({ assignment, onSave, onCancel }) {
  const [title, setTitle] = useState(assignment.title || '');
  const [description, setDescription] = useState(assignment.description || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) { setError('과제 제목을 입력해주세요.'); return; }
    setSaving(true); setError(null);
    try {
      await onSave({ title: title.trim(), description: description.trim() });
    } catch {
      setError('과제를 수정하지 못했어요. 다시 시도해주세요.');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-5 mb-6 space-y-3">
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">과제 제목</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} className={INPUT} />
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">설명 (선택)</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={1000} className={`${INPUT} resize-none`} />
      </label>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>취소</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? '저장 중...' : '저장'}</Button>
      </div>
    </form>
  );
}
