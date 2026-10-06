import { motion, AnimatePresence } from 'framer-motion';
import { Code2, Upload, Check, AlertCircle, Info } from 'lucide-react';
import Tooltip from '@/components/ui/Tooltip';

/**
 * HTML 코드 입력 필드 — 파일 업로드 + textarea + 글자수 카운터.
 * 부모(SubmissionForm)가 code/codeError state 관리, 이 컴포넌트는 controlled.
 */
export default function HtmlCodeField({
  code,
  onCodeChange,
  codeFileName,
  codeError,
  onFileSelect,
  fileInputRef,
  maxChars,
}) {
  return (
    <div>
      <div className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
        <Code2 size={13} className="text-slate-400" />
        결과물 HTML 코드
        <span className="text-red-500 ml-1 font-normal">필수</span>
        <Tooltip
          multiline
          label={`HTML 코드 확인하는 법\n\n1) 만든 결과물(웹페이지)에서 마우스 우클릭 → "페이지 소스 보기"\n2) 전체 선택(Ctrl/Cmd + A) → 복사 → 아래 칸에 붙여넣기\n\n또는 .html 파일이 있다면 "HTML 파일 선택" 버튼으로 첨부할 수 있어요.\n\n첨부한 코드는 제출 자료로 함께 보관됩니다.`}
        >
          <button
            type="button"
            aria-label="HTML 코드 확인 방법 안내"
            className="inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-full text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <Info size={13} />
          </button>
        </Tooltip>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); fileInputRef.current?.click(); }}
          className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[48px] text-[12px] font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
        >
          <Upload size={13} /> HTML 파일 선택
        </button>
        {codeFileName && (
          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
            <Check size={12} className="text-emerald-500 shrink-0" />
            <span className="truncate">{codeFileName}</span>
          </span>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".html,.htm,text/html"
          onChange={onFileSelect}
          className="sr-only"
          aria-label="HTML 파일 업로드"
        />
      </div>
      <textarea
        value={code}
        onChange={(e) => onCodeChange(e.target.value.slice(0, maxChars))}
        placeholder="파일을 선택하거나 HTML 코드를 직접 붙여넣으세요"
        aria-label="HTML 코드"
        rows={8}
        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3.5 text-[13px] font-mono text-slate-800 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-y transition-all leading-relaxed"
      />
      <div className="flex items-center justify-between mt-1.5">
        <AnimatePresence>
          {codeError ? (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              role="alert"
              className="text-[11px] text-red-500 flex items-center gap-1"
            >
              <AlertCircle size={11} /> {codeError}
            </motion.p>
          ) : (
            <p className="text-xs text-slate-300 dark:text-slate-500">파일 업로드 또는 직접 붙여넣기</p>
          )}
        </AnimatePresence>
        <p className="text-xs text-slate-300 dark:text-slate-500 tabular-nums">{code.length.toLocaleString()}/{maxChars.toLocaleString()}</p>
      </div>
    </div>
  );
}
