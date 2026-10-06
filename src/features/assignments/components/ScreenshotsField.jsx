import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Upload, X, Plus, Loader2, Info } from 'lucide-react';
import Tooltip from '@/components/ui/Tooltip';

/** 단일 스크린샷 썸네일 — uploading/error/loaded 상태 표시. */
function ScreenshotThumb({ shot, onRemove, idx }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="relative group rounded-lg overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700 bg-slate-50 dark:bg-slate-900 aspect-square"
    >
      {shot.uploading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 size={20} className="text-slate-400 animate-spin" />
        </div>
      ) : shot.error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2 text-center">
          <X size={16} className="text-red-400" />
          <p className="text-[10px] text-red-500 leading-tight line-clamp-2">{shot.error}</p>
        </div>
      ) : (
        <img src={shot.url} alt={shot.name || `스크린샷 ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
      )}
      {!shot.uploading && (
        <button
          type="button"
          onClick={() => onRemove(idx)}
          aria-label="이미지 삭제"
          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-slate-900/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-900"
        >
          <X size={12} />
        </button>
      )}
      <span className="absolute bottom-1 left-1.5 text-[10px] text-white bg-slate-900/60 rounded px-1.5 py-0.5 font-medium">
        {idx + 1}
      </span>
    </motion.div>
  );
}

/**
 * 결과물 스크린샷 다중 업로드 영역 — 빈 상태 dropzone / 그리드 + 추가 버튼.
 * 업로드/제거 핸들러는 부모(SubmissionForm)에서 useCallback으로 만들어 props로 받음.
 */
export default function ScreenshotsField({
  screenshots,
  validShotCount,
  onAddScreenshots,
  onRemove,
  fileInputRef,
  maxScreenshots,
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[13px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          결과물 스크린샷
          <span className="text-slate-300 dark:text-slate-500 ml-0.5 font-normal">선택</span>
          <Tooltip
            multiline
            label={`전체 화면을 캡쳐해서 첨부하면 더 정확한 평가를 받을 수 있어요.\n\n[Windows]\n• Windows + PrtSc — 전체 화면을 자동으로 "사진 > 스크린샷" 폴더에 저장\n• 또는 캡쳐 도구(Snipping Tool) 사용\n\n[Mac]\n• Command + Shift + 3 — 전체 화면을 바탕화면에 자동 저장\n• Command + Shift + 4 — 영역 지정 캡쳐`}
          >
            <button
              type="button"
              aria-label="스크린샷 캡쳐 방법 안내"
              className="inline-flex shrink-0 items-center justify-center w-11 h-11 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <Info size={13} />
            </button>
          </Tooltip>
        </div>
        <p className="text-[11px] text-slate-300 dark:text-slate-500">
          {validShotCount}/{maxScreenshots}장
        </p>
      </div>

      {screenshots.length === 0 ? (
        <label className="group flex flex-col items-center gap-2 py-8 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-600 cursor-pointer hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-all">
          <Upload size={20} className="text-slate-300 dark:text-slate-500 group-hover:text-slate-400 transition-colors" />
          <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">스크린샷 선택</span>
          <span className="text-xs text-slate-400 dark:text-slate-500">PNG · JPG · 최대 {maxScreenshots}장 · 장당 10MB</span>
          <input
            ref={fileInputRef}
            type="file"
            onChange={onAddScreenshots}
            className="hidden"
            accept="image/*"
            multiple
          />
        </label>
      ) : (
        <div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            <AnimatePresence>
              {screenshots.map((shot, i) => (
                <ScreenshotThumb
                  key={shot.url || shot.tempId || i}
                  shot={shot}
                  onRemove={onRemove}
                  idx={i}
                />
              ))}
            </AnimatePresence>

            {validShotCount < maxScreenshots && (
              <label className="group flex flex-col items-center justify-center gap-1 aspect-square rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-600 cursor-pointer hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-all">
                <Plus size={18} className="text-slate-300 dark:text-slate-500 group-hover:text-slate-400" />
                <span className="text-[10px] text-slate-400">추가</span>
                <input
                  type="file"
                  onChange={onAddScreenshots}
                  className="hidden"
                  accept="image/*"
                  multiple
                />
              </label>
            )}
          </div>
          <p className="text-xs text-slate-300 dark:text-slate-500 mt-2 flex items-center gap-1.5">
            <ImageIcon size={11} />
            결과물을 보여줄 화면이 있으면 첨부하세요. 여러 장 한 번에 선택 가능합니다.
          </p>
        </div>
      )}
    </div>
  );
}
