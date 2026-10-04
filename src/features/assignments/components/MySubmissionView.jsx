import { submissionImages } from '@/lib/submission-images';
import { useState } from 'react';
import { Link, ExternalLink, FileCode2, FileText, Pencil, Trash2, Image as ImageIcon, Code as CodeIcon } from 'lucide-react';
import { withdrawSubmission } from '@/features/assignments/api/useSubmissions';
import { safeHttpUrl } from '@/lib/utils';
import Button from '@/components/ui/Button';

// ─── MySubmissionView ──────────────────────────────
export default function MySubmissionView({ submission, assignmentId, onBack, onEdit, isOpen }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleWithdraw() {
    setDeleting(true);
    try {
      await withdrawSubmission(assignmentId, submission.id);
      onBack();
    } catch {
      alert('제출 취소에 실패했습니다');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="text-center mb-2">
        <p className="text-sm text-slate-400">{submission.name}님의 제출물</p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm divide-y divide-slate-100 dark:divide-slate-700">
        {safeHttpUrl(submission.projectUrl) && (
          <div className="flex items-center gap-3 px-5 py-4">
            <Link size={15} className="text-slate-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-400 mb-0.5">프로젝트 URL</p>
              <a href={safeHttpUrl(submission.projectUrl)} target="_blank" rel="noopener noreferrer"
                className="text-sm text-slate-900 dark:text-slate-100 truncate block hover:underline">
                {submission.projectUrl}
              </a>
            </div>
            <ExternalLink size={14} className="text-slate-300 shrink-0" />
          </div>
        )}
        {submission.prdContent && (
          <div className="px-5 py-4">
            <p className="text-xs text-slate-400 mb-1.5 flex items-center gap-1">
              <FileText size={12} /> PRD
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line line-clamp-6">
              {submission.prdContent}
            </p>
          </div>
        )}
        {Array.isArray(submission.screenshots) && submission.screenshots.length > 0 && (
          <div className="px-5 py-4">
            <p className="text-xs text-slate-400 mb-2 flex items-center gap-1">
              <ImageIcon size={12} /> 결과물 스크린샷 ({submission.screenshots.length}장)
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {submissionImages(submission.screenshots).map((s, i) => (
                <a
                  key={s.url}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block aspect-square rounded-lg overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700 hover:ring-slate-400 dark:hover:ring-slate-500 transition-all"
                >
                  <img src={s.url} alt={`스크린샷 ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                </a>
              ))}
            </div>
          </div>
        )}
        {submission.code && (
          <div className="px-5 py-4">
            <p className="text-xs text-slate-400 mb-1.5 flex items-center gap-1">
              <CodeIcon size={12} /> 결과물 HTML 코드 ({submission.code.length.toLocaleString()}자)
            </p>
            <pre className="text-[12px] font-mono text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap break-words bg-slate-50 dark:bg-slate-900 rounded-lg p-2.5 max-h-48 overflow-auto">
              {submission.code.slice(0, 2000)}{submission.code.length > 2000 && '\n…'}
            </pre>
          </div>
        )}
        {/* 구 폼 호환 표시 */}
        {submission.fileName && (
          <div className="flex items-center gap-3 px-5 py-4">
            <FileCode2 size={15} className="text-slate-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-400 mb-0.5">코드 파일</p>
              <p className="text-sm text-slate-900 dark:text-slate-100 truncate">{submission.fileName}</p>
            </div>
          </div>
        )}
        {submission.prdFileName && (
          <div className="flex items-center gap-3 px-5 py-4">
            <FileText size={15} className="text-slate-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-400 mb-0.5">PRD 파일 (구버전)</p>
              <p className="text-sm text-slate-900 dark:text-slate-100 truncate">{submission.prdFileName}</p>
            </div>
          </div>
        )}
        {submission.description && (
          <div className="px-5 py-4">
            <p className="text-xs text-slate-400 mb-1">프로젝트 설명</p>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {submission.description}
            </p>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-300 dark:text-slate-500 text-center">
        {submission.updatedAt ? '수정됨' : '제출됨'}
        {' · '}
        {new Date(submission.updatedAt || submission.submittedAt).toLocaleDateString('ko-KR', {
          month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
        })}
      </p>

      {isOpen && (
        <div className="space-y-2 pt-2">
          <Button onClick={onEdit} variant="primary" size="lg" className="w-full">
            <Pencil size={16} />
            수정하기
          </Button>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)}
              className="w-full text-center py-3 text-sm text-slate-400 hover:text-red-500 transition-colors">
              제출 취소
            </button>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
              <p className="text-sm text-red-600 dark:text-red-400 text-center">정말 제출을 취소하시겠어요?</p>
              <div className="flex gap-2">
                <Button onClick={() => setConfirmDelete(false)} variant="ghost" size="sm" className="flex-1">아니요</Button>
                <Button onClick={handleWithdraw} variant="danger" size="sm" disabled={deleting} className="flex-1">
                  <Trash2 size={14} />
                  {deleting ? '취소 중...' : '네, 취소할게요'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
