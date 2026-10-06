import { useState, useRef, useEffect, memo } from 'react';
import { uploadErrorMessage, MAX_UPLOAD_MB } from '@/lib/image-utils';
import { uploadImage } from '@/lib/image-upload';
import { imageRejection, normalizeImageFile } from '@/lib/image-file';
import { AnimatePresence } from 'framer-motion';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { logger } from '@/lib/logger';

const MAX_SIZE_MB = MAX_UPLOAD_MB;
const MAX_IMAGES = 10;

function SortableImage({ url, index, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: url });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 group cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
      <img src={url} alt={`이미지 ${index + 1}`} className="w-full h-full object-cover pointer-events-none" draggable={false} />
      <span className="absolute top-1 left-1 w-5 h-5 rounded bg-black/50 text-white text-[10px] font-bold flex items-center justify-center pointer-events-none">
        {index + 1}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(index); }}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center transition-opacity"
        aria-label="삭제"
      >
        <X size={12} />
      </button>
    </div>
  );
}

export default memo(function MultiImageUpload({ images = [], onChange }) {
  const [uploading, setUploading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const errorTimerRef = useRef(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // error 자동 해제 단일 타이머 — 언마운트 미정리 해소
  const showError = (msg, ms = 3000) => {
    setError(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setError(null), ms);
  };
  useEffect(() => () => { if (errorTimerRef.current) clearTimeout(errorTimerRef.current); }, []);

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = images.indexOf(active.id);
    const newIndex = images.indexOf(over.id);
    onChange(arrayMove(images, oldIndex, newIndex));
  }

  async function handleFiles(e) {
    // 윈도우는 MIME을 비우거나 옛 이름으로 주므로 파일 내용으로 형식을 다시 확인한다
    const files = await Promise.all(Array.from(e.target.files || []).map(normalizeImageFile));
    if (inputRef.current) inputRef.current.value = '';
    if (files.length === 0) return;

    const remaining = MAX_IMAGES - images.length;
    const toUpload = files.slice(0, remaining);
    if (toUpload.length === 0) {
      showError(`최대 ${MAX_IMAGES}장까지 가능합니다`);
      return;
    }

    // 형식·용량 문제는 파일별 이유를 그대로 보여준다(형식 이름 포함).
    const rejected = toUpload.map(f => imageRejection(f, MAX_SIZE_MB)).filter(Boolean);
    const valid = toUpload.filter(f => !imageRejection(f, MAX_SIZE_MB));
    if (rejected.length) {
      showError(rejected.length === 1 ? rejected[0] : `${rejected.length}개 파일은 올릴 수 없어요. ${rejected[0]}`, 7000);
    }
    if (valid.length === 0) return;

    setUploading(true);
    const urls = [];
    let failCount = 0;
    let lastError = '';
    for (let i = 0; i < valid.length; i++) {
      try {
        const url = await uploadImage(valid[i], 'questions', { onProgress: (p) => setProgressText(`${i + 1}/${valid.length} · ${Math.round(p * 100)}%`) });
        urls.push(url);
      } catch (err) {
        logger.error('Image upload failed:', valid[i].name, err);
        failCount++;
        lastError = uploadErrorMessage(err);
      }
    }
    if (urls.length > 0) onChange([...images, ...urls]);
    if (failCount > 0) {
      showError(`${failCount}개 이미지를 올리지 못했어요. ${lastError}`, 7000);
    }
    setUploading(false);
  }

  function removeImage(index) {
    onChange(images.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={images} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 gap-2">
              {images.map((url, i) => (
                <SortableImage key={url} url={url} index={i} onRemove={removeImage} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {images.length > 0 && images.length > 1 && (
        <p className="text-[11px] text-slate-600 dark:text-slate-300 text-center">드래그하여 순서 변경</p>
      )}

      {images.length < MAX_IMAGES && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full py-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500 hover:text-slate-500 dark:hover:text-slate-400 transition-colors flex items-center justify-center gap-2 text-sm active:scale-[0.98]"
        >
          {uploading ? (
            <><Loader2 size={16} className="animate-spin" /> <span className="tabular-nums">업로드 중 {progressText}</span></>
          ) : (
            <><ImagePlus size={16} /> 이미지 추가 ({images.length}/{MAX_IMAGES})</>
          )}
        </button>
      )}

      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400 text-center leading-relaxed [word-break:keep-all]">{error}</p>}

      <input ref={inputRef} type="file" accept="image/*,.heic,.heif" multiple onChange={handleFiles} className="hidden" />
    </div>
  );
});
