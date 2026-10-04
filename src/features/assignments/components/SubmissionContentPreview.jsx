import { submissionImages } from '@/lib/submission-images';
import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, FileCode2, FileText, X, Code as CodeIcon, Maximize2, ChevronLeft, ChevronRight } from 'lucide-react';
import { safeHttpUrl } from '@/lib/utils';

const PRD_PREVIEW_CHARS = 320;
const CODE_PREVIEW_LINES = 10;

/**
 * SubmissionContentPreview — 강사용 학생 제출 내용 표시.
 * 신 폼: PRD(텍스트) + screenshots(이미지 배열) + code(HTML, 선택).
 * 구 폼 호환: imageUrl/fileName/prdFileName/description.
 */
export default memo(function SubmissionContentPreview({ submission }) {
  const [imageOpen, setImageOpen] = useState(false);
  const [imageIdx, setImageIdx] = useState(0);
  const [codeOpen, setCodeOpen] = useState(false);
  const [prdExpanded, setPrdExpanded] = useState(false);

  if (!submission) return null;

  const screenshots = submissionImages(submission.screenshots);
  const hasAny = submission.imageUrl || submission.code || submission.projectUrl
    || submission.fileName || submission.description || submission.prdContent
    || submission.prdFileName || submission.title
    || screenshots.length > 0;

  if (!hasAny) {
    return <p className="text-sm text-slate-400 italic py-2">제출 내용이 없습니다</p>;
  }

  const codeText = submission.code || '';
  const codeLines = codeText.split('\n');
  const codePreview = codeLines.slice(0, CODE_PREVIEW_LINES).join('\n');
  const codeOverflow = codeLines.length > CODE_PREVIEW_LINES;

  const prd = submission.prdContent || '';
  const prdOverflow = prd.length > PRD_PREVIEW_CHARS;
  const prdShown = prdExpanded || !prdOverflow ? prd : prd.slice(0, PRD_PREVIEW_CHARS);

  function openShot(i) { setImageIdx(i); setImageOpen(true); }
  function nextShot() { setImageIdx((i) => (i + 1) % screenshots.length); }
  function prevShot() { setImageIdx((i) => (i - 1 + screenshots.length) % screenshots.length); }

  const ts = submission.updatedAt || submission.submittedAt;
  const tsLabel = ts ? new Date(ts).toLocaleString('ko-KR', {
    month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }) : null;
  const wasEdited = submission.updatedAt && submission.updatedAt !== submission.submittedAt;

  return (
    <div className="space-y-4">
      {submission.title && (
        <p className="text-base font-semibold text-slate-900 dark:text-slate-100 break-words">
          {submission.title}
        </p>
      )}

      {screenshots.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            결과물 스크린샷 ({screenshots.length}장)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {screenshots.map((s, i) => (
              <button
                key={s.url}
                onClick={() => openShot(i)}
                className="group relative block aspect-square overflow-hidden rounded-lg ring-1 ring-slate-200 dark:ring-slate-700 hover:ring-slate-400 dark:hover:ring-slate-500 transition-all active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                aria-label={`스크린샷 ${i + 1} 크게 보기`}
              >
                <img src={s.url} alt={`스크린샷 ${i + 1}`} className="w-full h-full object-cover bg-slate-50 dark:bg-slate-900" loading="lazy" />
                <span className="absolute top-1 right-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900/70 text-white text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  <Maximize2 size={9} />
                </span>
                <span className="absolute bottom-1 left-1.5 text-[10px] text-white bg-slate-900/60 rounded px-1.5 py-0.5 font-medium">
                  {i + 1}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 구 폼 호환: 단일 imageUrl */}
      {submission.imageUrl && screenshots.length === 0 && (
        <button
          onClick={() => { setImageIdx(0); setImageOpen(true); }}
          className="group relative block w-full overflow-hidden rounded-lg ring-1 ring-slate-200 dark:ring-slate-700 hover:ring-slate-400 dark:hover:ring-slate-500 transition-all active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
          aria-label="이미지 크게 보기"
        >
          <img
            src={submission.imageUrl}
            alt="제출 이미지"
            className="w-full max-h-72 object-contain bg-slate-50 dark:bg-slate-900"
            loading="lazy"
          />
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900/70 text-white text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            <Maximize2 size={11} /> 크게 보기
          </span>
        </button>
      )}

      {safeHttpUrl(submission.projectUrl) && (
        <a
          href={safeHttpUrl(submission.projectUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group"
        >
          <ExternalLink size={14} className="text-slate-400 shrink-0" />
          <span className="text-sm text-slate-700 dark:text-slate-200 truncate flex-1 group-hover:text-slate-900 dark:group-hover:text-slate-100">
            {submission.projectUrl}
          </span>
        </a>
      )}

      {submission.fileName && !codeText && (
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700">
          <FileCode2 size={14} className="text-slate-400 shrink-0" />
          <span className="text-sm text-slate-700 dark:text-slate-200 truncate flex-1">{submission.fileName}</span>
        </div>
      )}

      {submission.prdFileName && (
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700">
          <FileText size={14} className="text-slate-400 shrink-0" />
          <span className="text-sm text-slate-700 dark:text-slate-200 truncate flex-1">{submission.prdFileName}</span>
        </div>
      )}

      {submission.description && (
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">설명</p>
          <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line break-words">
            {submission.description}
          </p>
        </div>
      )}

      {prd && (
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            PRD / 기획서
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line break-words">
            {prdShown}{!prdExpanded && prdOverflow && '…'}
          </p>
          {prdOverflow && (
            <button
              onClick={() => setPrdExpanded(!prdExpanded)}
              className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 mt-2 transition-colors"
            >
              {prdExpanded ? '접기' : `더보기 (총 ${prd.length.toLocaleString()}자)`}
            </button>
          )}
        </div>
      )}

      {codeText && (
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <CodeIcon size={11} /> 코드 ({codeText.length.toLocaleString()}자)
            </p>
            {codeOverflow && (
              <button
                onClick={() => setCodeOpen(true)}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
              >
                전체 보기
              </button>
            )}
          </div>
          <pre className="text-[12px] leading-relaxed text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-900 rounded-lg p-3 overflow-x-auto font-mono whitespace-pre">
            <code>{codePreview}{codeOverflow && '\n…'}</code>
          </pre>
        </div>
      )}

      {tsLabel && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 pt-1">
          {wasEdited ? '수정됨' : '제출됨'} · {tsLabel}
        </p>
      )}

      <AnimatePresence>
        {imageOpen && (screenshots.length > 0 || submission.imageUrl) && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setImageOpen(false)}
            role="dialog" aria-modal="true" aria-label="제출 이미지 확대"
          >
            <button
              onClick={(e) => { e.stopPropagation(); setImageOpen(false); }}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              aria-label="닫기"
            >
              <X size={20} />
            </button>

            {screenshots.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); prevShot(); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                  aria-label="이전 이미지"
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); nextShot(); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                  aria-label="다음 이미지"
                >
                  <ChevronRight size={22} />
                </button>
                <span className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-medium">
                  {imageIdx + 1} / {screenshots.length}
                </span>
              </>
            )}

            <motion.img
              key={screenshots[imageIdx]?.url || submission.imageUrl}
              src={screenshots[imageIdx]?.url || submission.imageUrl}
              alt="제출 이미지 확대"
              initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="max-w-full max-h-[88dvh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {codeOpen && codeText && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setCodeOpen(false)}
            role="dialog" aria-modal="true" aria-label="제출 코드 전체"
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:w-[min(92vw,820px)] max-h-[88dvh] bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-700 shrink-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  전체 코드 · {codeText.length.toLocaleString()}자 · {codeLines.length.toLocaleString()}줄
                </p>
                <button
                  onClick={() => setCodeOpen(false)}
                  aria-label="닫기"
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <X size={18} className="text-slate-400" />
                </button>
              </div>
              <pre className="text-[13px] leading-relaxed text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-900 p-4 overflow-auto font-mono whitespace-pre flex-1 min-h-0">
                <code>{codeText}</code>
              </pre>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
