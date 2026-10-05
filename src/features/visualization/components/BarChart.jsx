import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useVotes } from '@/hooks/useVotes';
import { formatPercent } from '@/lib/utils';
import PollColumns from './PollColumns';
import AnimatedNumber from '@/components/ui/AnimatedNumber';

export default memo(function BarChart({ sessionId, questionId, options, correctValue = null, revealed = false, presenter = false, hideResults = false, page = 0, onPageChange }) {
  const { totalVotes, countByValue, resultsHidden, loading } = useVotes(sessionId, questionId);
  const concealed = resultsHidden || hideResults;
  const visibleTotal = concealed ? 0 : totalVotes;
  const counts = useMemo(() => options.map(option => concealed ? 0 : countByValue(option)), [options, countByValue, concealed]);
  const longest = Math.max(0, ...options.map(option => String(option).length));
  const pageSize = longest > 24 ? 2 : 6;
  const paged = presenter && options.length > pageSize;
  const pages = paged ? Math.ceil(options.length / pageSize) : 1;
  const currentPage = Math.min(Math.max(Number.isInteger(page) ? page : 0, 0), pages - 1);
  const shown = paged ? options.slice(currentPage * pageSize, currentPage * pageSize + pageSize) : options;
  const twoColumns = presenter && shown.length > 2 && longest <= 24;
  if (presenter && options.length >= 2 && options.length <= 4 && options.every(option => String(option).length <= 12)) {
    return <PollColumns options={options} counts={counts} total={visibleTotal} revealed={revealed} correctValue={correctValue} resultsHidden={concealed} loading={loading} />;
  }
  return <div className={presenter ? 'classroom-results classroom-bar-chart' : 'w-full max-w-xl mx-auto px-4'}>
    <div className={`classroom-result-grid grid ${twoColumns ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} ${presenter ? 'gap-4 lg:gap-5' : 'gap-4'}`}>
      {shown.map((option, offset) => {
        const index = (paged ? currentPage * pageSize : 0) + offset;
        const count = counts[index];
        const percent = visibleTotal ? count / visibleTotal * 100 : 0;
        const correct = revealed && correctValue === option;
        return <motion.div key={`${questionId}:${index}`} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
          data-correct={correct} className={`classroom-option-card rounded-xl border p-4 ${presenter ? 'lg:p-5' : ''} ${correct ? 'border-indigo-300 bg-indigo-100 text-indigo-950 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-600/70 dark:bg-slate-800/60 dark:text-slate-100'}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {correct && <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-900 text-white px-3 py-1 mb-2 text-sm lg:text-lg font-bold"><Check size={20} />정답</span>}
              <p className={`${presenter ? 'classroom-option-label' : 'text-lg'} font-semibold leading-snug break-words`}>{option}</p>
            </div>
            {!concealed && !loading && <div className="classroom-option-statistics flex items-baseline gap-3 shrink-0">
              <AnimatedNumber value={count} className={`${presenter ? 'classroom-option-count' : 'text-3xl'} leading-none font-bold tabular-nums`} />
              <p className={`${presenter ? 'text-lg lg:text-xl' : 'text-sm'} font-medium ${correct ? 'text-indigo-800' : 'text-slate-600 dark:text-slate-300'}`}>{formatPercent(count, visibleTotal)}</p>
            </div>}
          </div>
          <div className={`mt-3 ${presenter ? 'h-4 lg:h-5' : 'h-3'} rounded-full overflow-hidden ${correct ? 'bg-indigo-200' : 'bg-slate-200 dark:bg-slate-600'}`}>
            <motion.div initial={false} animate={{ scaleX: percent / 100 }} transition={{ type: 'spring', stiffness: 150, damping: 26 }}
              className={`h-full w-full origin-left ${correct ? 'bg-indigo-700' : 'bg-indigo-500'}`} />
          </div>
        </motion.div>;
      })}
    </div>
    {(!presenter || paged) && <div className={`classroom-results-footer flex items-center justify-center gap-4 mt-4 ${presenter ? 'text-lg lg:text-2xl' : 'text-sm'} text-slate-600 dark:text-slate-300`}>
      {!presenter && <span>{resultsHidden ? '정답 공개 후 집계됩니다' : loading ? '응답 집계를 불러오는 중' : <>총 <AnimatedNumber value={totalVotes} className="font-bold tabular-nums" />명 응답</>}</span>}
      {paged && <div className="inline-flex items-center gap-3">
        {onPageChange && <button className="presentation-button" aria-label="이전 보기 페이지" disabled={currentPage === 0} onClick={() => onPageChange(currentPage - 1)}><ChevronLeft size={20} /></button>}
        <span className="tabular-nums text-base">보기 {currentPage + 1} / {pages}</span>
        {onPageChange && <button className="presentation-button" aria-label="다음 보기 페이지" disabled={currentPage === pages - 1} onClick={() => onPageChange(currentPage + 1)}><ChevronRight size={20} /></button>}
      </div>}
    </div>}
  </div>;
});
