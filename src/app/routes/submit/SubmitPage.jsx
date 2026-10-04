import { useSearchParams } from 'react-router-dom';
import SubmissionPage from '@/features/assignments/components/SubmissionPage';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';

export default function SubmitPage() {
  const [params] = useSearchParams();
  const assignmentId = params.get('a');

  if (!assignmentId) {
    return (
      <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6">
        <div className="flex flex-col items-center text-center space-y-4 max-w-sm">
          <DoranDoranMascot size="lg" mood="thinking" />
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">잘못된 링크입니다</h2>
            <p className="text-slate-400 text-[15px] leading-relaxed">강사가 공유한 과제 링크를 다시 확인해주세요</p>
          </div>
          <a href="/" className="mt-2 px-5 py-2.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors">
            홈으로 돌아가기
          </a>
        </div>
      </div>
    );
  }

  return <SubmissionPage assignmentId={assignmentId} />;
}
