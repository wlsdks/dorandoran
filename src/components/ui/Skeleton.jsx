// 미사용 Skeleton/SkeletonText/SkeletonCard 제거 — 실사용: VotePageSkeleton, SuspenseFallback.

/** Layout-matching skeleton for student vote page. */
export function VotePageSkeleton() {
  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 flex flex-col">
      {/* Header skeleton */}
      <div className="bg-white dark:bg-slate-800 px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="animate-shimmer w-8 h-8 rounded-full" />
          <div className="animate-shimmer h-4 w-16 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="animate-shimmer w-8 h-8 rounded-full" />
          <div className="animate-shimmer w-8 h-8 rounded-full" />
        </div>
      </div>
      {/* Question + options skeleton */}
      <div className="flex-1 px-5 py-6 space-y-5 max-w-xl mx-auto w-full">
        {/* Question title */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 space-y-3">
          <div className="animate-shimmer h-3 w-20 rounded" />
          <div className="animate-shimmer h-5 w-full rounded" />
          <div className="animate-shimmer h-5 w-3/4 rounded" />
          <div className="animate-shimmer h-1.5 w-full rounded-full mt-2" />
        </div>
        {/* Options */}
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl py-4 px-5 flex items-center gap-3.5">
              <div className="animate-shimmer w-9 h-9 rounded-lg shrink-0" />
              <div className="animate-shimmer h-4 rounded flex-1" style={{ width: `${60 + i * 8}%` }} />
            </div>
          ))}
        </div>
      </div>
      {/* Bottom bar skeleton */}
      <div className="bg-white dark:bg-slate-800 px-5 py-4">
        <div className="flex justify-between gap-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="animate-shimmer w-14 h-14 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Lightweight Suspense fallback — centered mascot for lazy-loaded routes/sections. */
export function SuspenseFallback({ fullPage = true }) {
  // 로딩 중에는 정적 SVG를 직접 표시해 애니메이션 모듈을 불러오지 않는다.
  return (
    <div className={`${fullPage ? 'min-h-dvh' : 'min-h-[200px]'} bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center gap-3`}>
      <img src="/characters/dorandoran-waiting.svg" alt="" aria-hidden="true" width={64} height={48}
        style={{ objectFit: 'contain' }} />
      <span className="text-sm text-slate-600 dark:text-slate-300">불러오는 중...</span>
    </div>
  );
}
