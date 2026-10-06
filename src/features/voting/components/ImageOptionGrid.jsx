import { useState, memo } from 'react';
import { motion } from 'framer-motion';
import { Maximize2, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { hapticTap } from '@/lib/haptics';
import { isAutoPhotoName } from '@/lib/option-images';

/**
 * 사진 보기 — 카드 전체를 누르면 고르고, 오른쪽 위 확대 버튼은 고르지 않고 크게만 본다
 * (버튼 안에 버튼을 넣을 수 없어 확대 버튼은 카드 옆 형제로 겹쳐 둔다).
 */
export default memo(function ImageOptionGrid({ options, images, selected, locked = false, disabled = false, pendingOption = null, onPick }) {
  const [zoomIndex, setZoomIndex] = useState(null);
  const hasSelection = selected !== null && selected !== undefined;

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        {options.map((option, i) => {
          const letter = String.fromCharCode(65 + i);
          const image = images[i];
          const isSelected = selected === option;
          const dimmed = hasSelection && !isSelected;
          return (
            <motion.div key={option} className="relative"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: dimmed ? 0.3 : 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25, delay: hasSelection ? 0 : i * 0.05 }}>
              <button type="button" onClick={() => { hapticTap(); onPick(option); }} disabled={locked || disabled || hasSelection}
                aria-label={`${letter}. ${option}`} aria-pressed={isSelected}
                className={`w-full h-full flex flex-col overflow-hidden rounded-xl border bg-white dark:bg-slate-800 text-left transition-colors duration-150 active:scale-[0.97] ${isSelected ? 'ring-2 ring-slate-400 dark:ring-slate-500 border-slate-300 dark:border-slate-500' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'} ${dimmed ? 'pointer-events-none' : ''}`}>
                <span className="block aspect-square w-full bg-slate-100 dark:bg-slate-700">
                  {image
                    ? <img src={image} alt={`${letter} 보기 사진`} loading="eager" className="h-full w-full object-contain bg-slate-100 dark:bg-slate-900" />
                    : <span className="flex h-full items-center justify-center px-3 text-center text-base font-medium text-slate-700 dark:text-slate-200 [word-break:keep-all]">{option}</span>}
                </span>
                <span className="flex min-h-12 items-center gap-2 px-3 py-2">
                  <span className="w-7 h-7 rounded-lg bg-slate-700 dark:bg-slate-300 text-white dark:text-slate-900 flex items-center justify-center text-sm font-bold shrink-0">{letter}</span>
                  <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-slate-800 dark:text-slate-200 [word-break:keep-all] [overflow-wrap:anywhere]">{image && !isAutoPhotoName(option) ? option : ''}</span>
                  {pendingOption === option && <span className="text-xs text-slate-600 dark:text-slate-400 shrink-0">전송 중...</span>}
                </span>
              </button>
              {image && (
                <button type="button" onClick={() => setZoomIndex(i)} aria-label={`${letter} 보기 사진 크게 보기`}
                  className="absolute top-1 right-1 flex h-11 w-11 items-center justify-center rounded-full">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow ring-1 ring-black/10">
                  <Maximize2 size={15} /></span>
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
      <Modal open={zoomIndex !== null} onClose={() => setZoomIndex(null)} centered ariaLabel="보기 사진" className="rounded-2xl p-3!">
        {zoomIndex !== null && <>
          <img src={images[zoomIndex]} alt={`${String.fromCharCode(65 + zoomIndex)} 보기 사진`} className="max-h-[70dvh] w-full object-contain rounded-lg" />
          <p className="mt-2 text-center text-sm font-medium text-slate-700 dark:text-slate-200">{String.fromCharCode(65 + zoomIndex)}. {options[zoomIndex]}</p>
          <button type="button" onClick={() => setZoomIndex(null)} className="mt-2 min-h-12 w-full rounded-lg font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">
            <X size={16} className="mr-1 inline" />닫기
          </button>
        </>}
      </Modal>
    </>
  );
});
