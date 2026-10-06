import { useState } from 'react';
import { lookupSubmission, lookupErrorMessage } from '@/features/assignments/api/useSubmissions';
import Button from '@/components/ui/Button';

// ─── LookupForm ────────────────────────────────────
export default function LookupForm({ assignmentId, onFound }) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLookup() {
    if (!name.trim() || ! /^(?:\d{4}|\d{8})$/.test(pin)) return;
    setLoading(true);
    setError('');
    try {
      const result = await lookupSubmission(assignmentId, name.trim(), pin);
      if (result.error === 'NOT_FOUND') setError('해당 이름의 제출물을 찾을 수 없습니다. 제출 시 입력한 이름을 정확히 입력해주세요.');
      else if (result.error === 'PIN_MISMATCH') setError('이름 또는 조회용 비밀번호가 일치하지 않습니다. 다시 확인해주세요.');
      else onFound(result.submission);
    } catch (err) {
      setError(lookupErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mb-2">이름</p>
        <input type="text" value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          placeholder="제출 시 입력한 이름"
          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3.5 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          autoFocus
        />
      </div>
      <div>
        <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mb-2">조회용 비밀번호</p>
        <input type="password" inputMode="numeric" pattern="[0-9]*" value={pin}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 8)); setError(''); }}
          placeholder="조회용 비밀번호" maxLength={8}
          onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleLookup()}
          className={`w-full bg-white dark:bg-slate-800 border rounded-xl px-4 py-3.5 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all tracking-[0.3em] ${
            error ? 'border-red-400 focus:ring-red-500/20' : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500/20 focus:border-indigo-500'
          }`}
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <Button onClick={handleLookup} variant="primary" size="lg" disabled={!name.trim() || ! /^(?:\d{4}|\d{8})$/.test(pin) || loading} className="w-full">
        {loading ? '조회 중...' : '조회하기'}
      </Button>
    </div>
  );
}
