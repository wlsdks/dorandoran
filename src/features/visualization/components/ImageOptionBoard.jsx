import { memo } from 'react';
import { motion } from 'framer-motion';
import { Check, ImageOff } from 'lucide-react';
import { formatPercent } from '@/lib/utils';
import AnimatedNumber from '@/components/ui/AnimatedNumber';
import { isAutoPhotoName } from '@/lib/option-images';

// 보기 수 → 열 수. 사진을 비교해 고르는 문제라 사진이 크게, 한 줄에 나란히 보여야 한다(5개만 3+2).
const COLUMNS = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-2 xl:grid-cols-4', 5: 'grid-cols-3' };
// 보기가 적으면 카드가 너무 커져 세로로 넘치므로 판 전체 폭을 줄인다. 4~5개는 발표 화면 폭을 다 쓴다.
const MAX_WIDTH = { 1: 'max-w-3xl', 2: 'max-w-5xl', 3: 'max-w-6xl' };

/**
 * 사진 보기 결과판 — 카드마다 큰 사진, 그 아래 보기 글자·이름, 맨 아래 응답 수와 막대.
 * 결과를 숨기는 동안에는 사진과 이름만 보여 학생이 앞 화면을 보고 고를 수 있게 한다.
 */
export default memo(function ImageOptionBoard({ options, optionImages, counts, total, revealed, correctValue, concealed, loading, presenter }) {
  const columns = presenter ? COLUMNS[options.length] || 'grid-cols-3' : 'grid-cols-2';
  const showStats = !concealed && !loading;
  return (
    <div className={`grid ${columns} ${presenter ? `gap-5 lg:gap-6 w-full mx-auto ${MAX_WIDTH[options.length] || ''}` : 'gap-3 w-full max-w-xl mx-auto px-4'}`}>
      {options.map((option, index) => {
        const letter = String.fromCharCode(65 + index);
        const count = counts[index];
        const percent = total ? count / total * 100 : 0;
        const correct = revealed && correctValue === option;
        const dimmed = revealed && correctValue != null && !correct;
        const image = optionImages[index];
        return (
          <motion.figure key={index} data-correct={correct}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: dimmed ? 0.55 : 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25, delay: index * 0.05 }}
            className={`relative flex flex-col overflow-hidden rounded-2xl border bg-white dark:bg-slate-800 ${correct ? 'border-indigo-500 ring-4 ring-indigo-500/40' : 'border-slate-200 dark:border-slate-700'}`}>
            <div className="relative aspect-[4/3] bg-slate-100 dark:bg-slate-900">
              {image
                ? <img src={image} alt={`${letter} 보기 사진`} className="absolute inset-0 h-full w-full object-contain" />
                : <div className="absolute inset-0 flex items-center justify-center text-slate-400"><ImageOff size={presenter ? 40 : 24} aria-hidden="true" /></div>}
              {/* 보기 글자는 사진 위 왼쪽 위 — 뒷자리에서도 "B번 사진"을 바로 가리킬 수 있게 */}
              <span className={`absolute left-3 top-3 flex items-center justify-center rounded-xl bg-slate-900/85 text-white font-bold shadow ${presenter ? 'h-12 w-12 text-2xl lg:h-14 lg:w-14 lg:text-3xl' : 'h-8 w-8 text-base'}`}>{letter}</span>
              {correct && <span className={`absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 text-white font-bold shadow ${presenter ? 'px-4 py-2 text-xl lg:text-2xl' : 'px-2.5 py-1 text-sm'}`}><Check size={presenter ? 24 : 16} />정답</span>}
            </div>
            {/* 숫자는 하나만 크게(비율), 인원은 막대 아래 작게 — "0 0%"처럼 숫자 두 개가 붙지 않게 */}
            <figcaption className={presenter ? 'px-4 pt-3 pb-4 lg:px-5 space-y-2' : 'px-3 pt-2.5 pb-3 space-y-1.5'}>
              <div className="flex items-baseline justify-between gap-3 min-h-[1.5em]">
                <span className={`min-w-0 font-semibold leading-snug text-slate-900 dark:text-slate-100 [word-break:keep-all] ${presenter ? 'text-lg lg:text-xl' : 'text-sm'}`}>{isAutoPhotoName(option) ? '' : option}</span>
                {showStats && <span className={`shrink-0 font-bold tabular-nums leading-none text-slate-900 dark:text-slate-100 ${presenter ? 'text-2xl lg:text-3xl' : 'text-lg'}`}>{formatPercent(count, total)}</span>}
              </div>
              {showStats && <>
                <div className={`${presenter ? 'h-2.5' : 'h-1.5'} rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700`}>
                  <motion.div initial={false} animate={{ scaleX: percent / 100 }} transition={{ type: 'spring', stiffness: 150, damping: 26 }}
                    className="h-full w-full origin-left bg-indigo-500" />
                </div>
                <p className={`text-right tabular-nums text-slate-500 dark:text-slate-400 ${presenter ? 'text-sm lg:text-base' : 'text-xs'}`}><AnimatedNumber value={count} className="font-semibold text-slate-700 dark:text-slate-300" />명</p>
              </>}
            </figcaption>
          </motion.figure>
        );
      })}
    </div>
  );
});
