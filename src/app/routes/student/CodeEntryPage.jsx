import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import Button from '@/components/ui/Button';

// 세션 링크 없이 들어온 학생용 — 앞 화면의 수업 코드를 입력해 참여한다.
// 없는 코드는 참여 화면이 "세션을 찾을 수 없어요"로 안내한다.
export default function CodeEntryPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const trimmed = code.trim();

  function handleSubmit(event) {
    event.preventDefault();
    if (!trimmed) return;
    navigate(`/?s=${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center px-5">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6 text-center">
        <div className="flex justify-center"><DoranDoranMascot size="md" mood="waiting" /></div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">수업 코드 입력</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">앞 화면에 보이는 수업 코드를 입력해주세요</p>
        </div>
        <input
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="예: s_1a2b3c4d"
          aria-label="수업 코드"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 text-base text-center tracking-wide text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
        />
        <Button type="submit" variant="primary" size="md" disabled={!trimmed} className="w-full min-h-12">
          참여하기 <ArrowRight size={18} />
        </Button>
        <a href="/admin" className="inline-block text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline-offset-4 hover:underline">강사 로그인</a>
      </form>
    </div>
  );
}
