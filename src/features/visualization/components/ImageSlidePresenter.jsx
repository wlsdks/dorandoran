import { memo, useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { prepareImage, retainImageCache } from '@/lib/presentation-images';
import Button from '@/components/ui/Button';

/** 관객 화면은 크게, 제어는 발표자에게만. 준비된 이미지끼리 짧게 교차 전환한다. */
export default memo(function ImageSlidePresenter({ images = [], currentSlide = 0, onSlideChange, presenter = false }) {
  const current = Math.max(0, Math.min(Number.isInteger(currentSlide) ? currentSlide : 0, images.length - 1));
  const url = images[current];
  const series = JSON.stringify(images);
  const frames = useMemo(() => JSON.parse(series), [series]);
  const [snapshot, setSnapshot] = useState(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => retainImageCache(), []);
  useEffect(() => {
    if (!url) return;
    let active = true;
    prepareImage(url, 'high').then(src => { if (active) setSnapshot({ series, src, current, error: null }); })
      .catch(error => { if (active && error.name !== 'AbortError') setSnapshot(previous => ({ series, src: previous?.series === series ? previous.src : null, current, error })); });
    // 인접 이미지의 디코딩을 끝내 다음/이전 조작에서 다시 기다리지 않는다.
    for (const index of [current + 1, current - 1]) if (frames[index]) prepareImage(frames[index]).catch(() => {});
    return () => { active = false; };
  }, [url, series, current, revision, frames]); // images 자체의 재생성은 로딩을 재시작하지 않는다.
  if (!images.length) return <p className="text-slate-400 text-center">등록된 슬라이드가 없습니다</p>;
  const displayed = snapshot?.series === series ? snapshot : null;
  const pending = displayed?.src !== url && !displayed?.error;
  const controls = onSlideChange && !presenter;
  return (
    <div className={`w-full mx-auto ${presenter ? 'h-full min-h-0' : 'max-w-5xl px-4'}`}>
      <div className={`relative overflow-hidden ${presenter ? 'w-full h-[calc(100dvh-11rem)]' : 'rounded-2xl aspect-video bg-slate-100 dark:bg-slate-800'}`} aria-busy={pending}>
        <AnimatePresence initial={false} mode="sync">
          {displayed?.src && <motion.img key={displayed.src} src={displayed.src} alt={`슬라이드 ${displayed.current + 1}`}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
            decoding="async" fetchPriority="high" className="absolute inset-0 h-full w-full object-contain" />}
        </AnimatePresence>
        {pending && <div role="status" className={`absolute ${displayed?.src ? 'right-4 bottom-4' : 'inset-0 flex items-center justify-center'} text-sm text-slate-400`}>
          <span className="px-3 py-2 rounded-lg bg-slate-900/80 text-slate-100">슬라이드 준비 중…</span>
        </div>}
        {displayed?.error && <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/90 text-slate-100">
          <p>이미지를 불러오지 못했어요</p><Button onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} />다시 시도</Button>
        </div>}
        {controls && <>
          <button onClick={() => onSlideChange(current - 1)} disabled={current === 0} aria-label="이전 슬라이드"
            className="absolute left-3 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-slate-900/70 text-white flex items-center justify-center disabled:opacity-30"><ChevronLeft size={24} /></button>
          <button onClick={() => onSlideChange(current + 1)} disabled={current === images.length - 1} aria-label="다음 슬라이드"
            className="absolute right-3 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-slate-900/70 text-white flex items-center justify-center disabled:opacity-30"><ChevronRight size={24} /></button>
        </>}
        {!(presenter && onSlideChange) && <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/70 px-3 py-1.5 text-white text-xs tabular-nums">
          {(displayed?.current ?? current) + 1} / {images.length}
        </div>}
      </div>
      {controls && <div className="flex justify-center gap-1.5 mt-3">
        {images.map((_, index) => index).filter(index => Math.abs(index - current) <= 3).map(index => <button key={index}
          onClick={() => onSlideChange(index)} aria-label={`슬라이드 ${index + 1}`} aria-current={index === current ? 'page' : undefined}
          className={`h-10 w-10 rounded-lg text-sm tabular-nums ${index === current ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>{index + 1}</button>)}
      </div>}
    </div>
  );
});
