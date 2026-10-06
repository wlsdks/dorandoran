/** 사이드바 경계 손잡이 — 끌어서 폭 조절, 두 번 클릭하면 기본 폭. 키보드 ←/→ 도 된다. */
export default function ResizeHandle({ side = 'left', width, min, max, dragging, label, ...handlers }) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(width)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title="끌어서 폭 조절 · 두 번 클릭하면 기본 폭"
      {...handlers}
      className={`group absolute top-0 ${side === 'left' ? '-right-1.5' : '-left-1.5'} z-10 h-full w-3 cursor-col-resize touch-none focus:outline-none`}
    >
      <span className={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 transition-colors duration-150 ${dragging ? 'bg-indigo-500' : 'bg-transparent group-hover:bg-slate-300 group-focus-visible:bg-indigo-500 dark:group-hover:bg-slate-600'}`} />
    </div>
  );
}
