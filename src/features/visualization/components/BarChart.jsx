import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useVotes } from '@/hooks/useVotes';
import { formatPercent } from '@/lib/utils';
import PollColumns from './PollColumns';
import ImageOptionBoard from './ImageOptionBoard';
import AnimatedNumber from '@/components/ui/AnimatedNumber';

// columns=false: 옆에 정답 해설이 붙어 폭이 좁을 때. 세로 막대는 좁으면 보기 글자가 한 음절씩 끊기므로 가로 막대로 그린다.
export default memo(function BarChart({ sessionId, questionId, options, correctValue = null, revealed = false, presenter = false, hideResults = false, page = 0, onPageChange, columns = true, optionImages = null }) {
  const { totalVotes, countByValue, resultsHidden, loading } = useVotes(sessionId, questionId);
  const concealed = resultsHidden || hideResults;
  const visibleTotal = concealed ? 0 : totalVotes;
  const counts = useMemo(() => options.map(option => concealed ? 0 : countByValue(option)), [options, countByValue, concealed]);
  const longest = Math.max(0, ...options.map(option => String(option).length));
  // 긴 보기여도 일반 퀴즈(최대 4개)는 한 화면에 모두 보여야 한다. 5개 이상일 때만 나눈다.
  const hasImages = Array.isArray(optionImages) && optionImages.some(Boolean);
  const pageSize = longest > 24 ? 4 : 6;
  const paged = presenter && options.length > pageSize;
  const pages = paged ? Math.ceil(options.length / pageSize) : 1;
  const currentPage = Math.min(Math.max(Number.isInteger(page) ? page : 0, 0), pages - 1);
  const shown = paged ? options.slice(currentPage * pageSize, currentPage * pageSize + pageSize) : options;
  const twoColumns = columns && presenter && shown.length > 2 && longest <= 24;
  if (!hasImages && columns && presenter && options.length >= 2 && options.length <= 4 && options.every(option => String(option).length <= 12)) {
    return <PollColumns options={options} counts={counts} total={visibleTotal} revealed={revealed} correctValue={correctValue} resultsHidden={concealed} loading={loading} />;
  }
  // 사진 보기는 가로 막대가 아니라 사진이 주인공인 카드판으로 그린다(보기 최대 5개라 한 화면에 모두 들어간다).
  if (hasImages) return <div className={presenter ? 'classroom-results' : 'w-full'}>
    <ImageOptionBoard options={options} optionImages={optionImages} counts={counts} total={visibleTotal} revealed={revealed}
      correctValue={correctValue} concealed={concealed} loading={loading} presenter={presenter} />
    {!presenter && <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-300">
      {resultsHidden ? '정답 공개 후 집계됩니다' : loading ? '응답 집계를 불러오는 중' : <>총 <AnimatedNumber value={totalVotes} className="font-bold tabular-nums" />명 응답</>}
    </p>}
  </div>;
  return <div className={presenter ? 'classroom-results classroom-bar-chart' : 'w-full max-w-xl mx-auto px-4'}>
    <div className={`classroom-result-grid grid ${twoColumns ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} ${presenter ? 'gap-3 lg:gap-4' : 'gap-4'}`}>
      {shown.map((option, offset) => {
        const index = (paged ? currentPage * pageSize : 0) + offset;
        const count = counts[index];
        const percent = visibleTotal ? count / visibleTotal * 100 : 0;
        const correct = revealed && correctValue === option;
        // 정답 공개 뒤 틀린 보기는 살짝 가라앉힌다 — Framer가 inline opacity를 쥐고 있어 CSS 클래스 대신 여기서 애니메이션한다
        const dimmed = revealed && correctValue != null && !correct;
        return <motion.div key={`${questionId}:${index}`} initial={{ opacity: 0, y: 5 }} animate={{ opacity: dimmed ? 0.55 : 1, y: 0 }} transition={{ duration: 0.2 }}
          data-correct={correct} className={`classroom-option-card rounded-xl border ${presenter ? 'px-4 py-3 lg:px-5 lg:py-3.5' : 'p-4'} ${correct ? 'answer-glow border-indigo-300 bg-indigo-50 text-indigo-950 dark:border-indigo-400/70 dark:bg-indigo-500/15 dark:text-slate-50' : 'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-600/70 dark:bg-slate-800/60 dark:text-slate-100'}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {/* 정답 배지는 보기와 같은 줄에 둔다 — 따로 한 줄을 쓰면 긴 보기 4개가 발표 화면을 넘친다 */}
              <p className={`${presenter ? 'classroom-option-label' : 'text-lg'} font-semibold leading-snug break-words flex items-start gap-3`}>
                <span className="poll-option-letter shrink-0">{String.fromCharCode(65 + index)}</span>
                <span className="min-w-0">{option}</span>
                {correct && <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-indigo-600 dark:bg-indigo-500 text-white px-2 py-0.5 text-sm lg:text-base font-semibold whitespace-nowrap self-center"><Check size={16} />정답</span>}
              </p>
            </div>
            {/* 숫자는 비율 하나만 크게. 인원은 막대 아래 작게 둬 "1 20%"처럼 숫자 두 개가 붙지 않게 한다. */}
            {!concealed && !loading && <p className={`classroom-option-statistics shrink-0 ${presenter ? 'classroom-option-count' : 'text-2xl'} leading-none font-bold tabular-nums ${correct ? 'text-indigo-700 dark:text-indigo-200' : ''}`}>{formatPercent(count, visibleTotal)}</p>}
          </div>
          <div className={`mt-3 ${presenter ? 'h-2.5 lg:h-3' : 'h-2'} rounded-full overflow-hidden ${correct ? 'bg-indigo-200 dark:bg-indigo-400/20' : 'bg-slate-200 dark:bg-slate-700'}`}>
            <motion.div initial={false} animate={{ scaleX: percent / 100 }} transition={{ type: 'spring', stiffness: 150, damping: 26 }}
              className={`h-full w-full origin-left ${correct ? 'bg-indigo-600 dark:bg-indigo-400' : revealed && correctValue ? 'bg-slate-400 dark:bg-slate-500' : 'bg-indigo-500'}`} />
          </div>
          {!concealed && !loading && <p className={`mt-1.5 text-right tabular-nums text-slate-500 dark:text-slate-400 ${presenter ? 'text-sm lg:text-base' : 'text-xs'}`}><AnimatedNumber value={count} className="font-semibold text-slate-700 dark:text-slate-300" />명</p>}
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
