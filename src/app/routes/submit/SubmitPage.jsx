import { useSearchParams } from 'react-router-dom';
import SubmissionPage from '@/features/assignments/components/SubmissionPage';
import EmptyState from '@/components/ui/EmptyState';

export default function SubmitPage() {
  const [params] = useSearchParams();
  const assignmentId = params.get('a');

  if (!assignmentId) {
    return (
      <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6">
        <EmptyState title="잘못된 링크입니다" titleAs="h1" description="강사가 공유한 과제 링크를 다시 확인해 주세요." mascotSize="lg" mood="thinking">
          <a href="/" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-900 dark:bg-slate-100 px-5 text-sm font-semibold text-white dark:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">홈으로 돌아가기</a>
        </EmptyState>
      </div>
    );
  }

  return <SubmissionPage assignmentId={assignmentId} />;
}
