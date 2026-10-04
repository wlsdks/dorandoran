import { useId, useState } from 'react';
import { Timer, Play, Square } from 'lucide-react';

const PRESETS = [15, 30, 60];

export default function TimerControls({ isRunning, onStart, onStop }) {
  const [customSeconds, setCustomSeconds] = useState(30);
  const customId = useId();

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
        <Timer size={12} />
        타이머
      </div>

      {!isRunning ? (
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((sec) => (
            <button
              key={sec}
              onClick={() => onStart(sec)}
              aria-label={`${sec}초 타이머 시작`}
              className="min-h-12 rounded-lg bg-slate-50 dark:bg-slate-600 hover:bg-slate-200 dark:hover:bg-slate-500 hover:text-slate-900 dark:hover:text-white text-slate-600 dark:text-slate-300 text-sm font-medium transition-colors duration-150"
            >
              {sec}초
            </button>
          ))}
          <div className="col-span-3 flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-600 px-3">
            <label htmlFor={customId} className="text-sm text-slate-500 dark:text-slate-300">직접 설정</label>
            <input
              type="number"
              id={customId}
              min={5}
              max={300}
              value={customSeconds}
              onChange={(e) => setCustomSeconds(e.target.value)}
              className="w-16 min-h-12 bg-transparent text-slate-700 dark:text-slate-200 text-center text-base font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 rounded-lg"
            />
            <span className="text-sm text-slate-500 dark:text-slate-300">초</span>
            <button
              onClick={() => onStart(Math.max(5, Math.min(300, Number(customSeconds) || 30)))}
              aria-label="커스텀 타이머 시작"
              className="ml-auto inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-500 transition-colors duration-150"
            >
              <Play size={20} />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={onStop}
          aria-label="타이머 중지"
          className="w-full min-h-12 rounded-lg bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-500 transition-colors duration-150 flex items-center justify-center gap-2"
        >
          <Square size={20} />
          타이머 중지
        </button>
      )}
    </div>
  );
}
