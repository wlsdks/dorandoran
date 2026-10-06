import { useMemo, memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVotes } from '@/hooks/useVotes';
import { MessageCircle, ChevronLeft, ChevronRight } from 'lucide-react';

/** Parse debate vote value "for:opinion text" -> { side, opinion } */
function parseDebateVote(value) {
  if (typeof value !== 'string') return null;
  const colonIdx = value.indexOf(':');
  if (colonIdx < 0) return null;
  const side = value.slice(0, colonIdx);
  const opinion = value.slice(colonIdx + 1).trim();
  if (side !== 'for' && side !== 'against') return null;
  return { side, opinion };
}

export default memo(function DebateChart({ sessionId, questionId, presenter = false, readOnly = false, page = 0, onPageChange }) {
  const { voteList, totalVotes } = useVotes(sessionId, questionId);
  const [filter, setFilter] = useState('all'); // 'all' | 'for' | 'against'

  const { forCount, againstCount, opinions } = useMemo(() => {
    let f = 0;
    let a = 0;
    const ops = [];

    voteList.forEach((v) => {
      const parsed = parseDebateVote(v.value);
      if (!parsed) return;
      if (parsed.side === 'for') f++;
      else a++;

      if (parsed.opinion) {
        ops.push({
          id: v.id,
          side: parsed.side,
          opinion: parsed.opinion,
          nickname: v.nickname || '',
          timestamp: v.timestamp || 0,
        });
      }
    });

    // Sort by timestamp descending (newest first)
    ops.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return { forCount: f, againstCount: a, opinions: ops };
  }, [voteList]);

  // 찬반으로 읽힌 응답만 분모로 쓰고, 반올림 합이 100%를 넘지 않게 한쪽을 나머지로 계산한다.
  const sideTotal = forCount + againstCount;
  const forPct = sideTotal > 0 ? Math.round((forCount / sideTotal) * 100) : 0;
  const againstPct = sideTotal > 0 ? 100 - forPct : 0;

  const filteredOpinions = useMemo(() => {
    if (filter === 'all') return opinions;
    return opinions.filter((o) => o.side === filter);
  }, [opinions, filter]);

  const pages = presenter ? Math.max(1, Math.ceil(filteredOpinions.length / 3)) : 1;
  const currentPage = Math.min(Math.max(Number.isInteger(page) ? page : 0, 0), pages - 1);
  const shownOpinions = presenter ? filteredOpinions.slice(currentPage * 3, currentPage * 3 + 3) : filteredOpinions;

  return (
    <div className={`${presenter ? 'space-y-4 max-w-3xl' : 'space-y-6 max-w-xl'} w-full mx-auto px-8`}>
      {/* Hero ratio display */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="flex items-center justify-between text-center"
      >
        <div className="flex-1 space-y-1">
          <motion.p
            key={forCount}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            className="text-5xl font-black text-slate-900 dark:text-slate-100 tabular-nums"
          >
            {forPct}%
          </motion.p>
          <p className="text-lg font-bold tracking-tight text-slate-600 dark:text-slate-300">찬성</p>
          <p className="text-sm text-slate-400 dark:text-slate-500">{forCount}명</p>
        </div>

        <div className="px-4">
          <div className="text-slate-200 dark:text-slate-700 text-xl font-bold tracking-tight">VS</div>
        </div>

        <div className="flex-1 space-y-1">
          <motion.p
            key={againstCount}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            className="text-5xl font-black text-slate-900 dark:text-slate-100 tabular-nums"
          >
            {againstPct}%
          </motion.p>
          <p className="text-lg font-bold tracking-tight text-slate-600 dark:text-slate-300">반대</p>
          <p className="text-sm text-slate-400 dark:text-slate-500">{againstCount}명</p>
        </div>
      </motion.div>

      {/* Ratio bar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-2"
      >
        <div className="debate-ratio-bar h-6 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
          <motion.div
            animate={{ width: `${forPct}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="bg-slate-800 h-full rounded-l-full"
          />
          <motion.div
            animate={{ width: `${againstPct}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="bg-slate-300 h-full rounded-r-full"
          />
        </div>
        {/* 발표 화면은 위 큰 숫자와 겹치므로 생략해 세로 공간을 아낀다 */}
        {!presenter && <div className="flex justify-between text-sm font-semibold">
          <span className="text-slate-700 dark:text-slate-200">{forPct}%</span>
          <span className="text-slate-400 text-xs font-normal">총 {sideTotal}명</span>
          <span className="text-slate-500">{againstPct}%</span>
        </div>}
      </motion.div>

      {/* Opinions stream */}
      {opinions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          {/* Filter tabs */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <MessageCircle size={14} className="text-slate-400" />
              <p className={`${presenter ? 'text-[clamp(14px,1vw,22px)]' : 'text-xs'} font-semibold text-slate-400 tracking-wider uppercase`}>의견{presenter && ` ${opinions.length}개 · ${sideTotal}명 참여`}</p>
            </div>
            {!readOnly && !presenter && <div className="flex gap-1">
              {[
                { value: 'all', label: '전체' },
                { value: 'for', label: '찬성' },
                { value: 'against', label: '반대' },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`min-h-11 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 active:scale-[0.96] ${
                    filter === f.value
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                      : 'bg-slate-50 dark:bg-slate-700 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>}
          </div>

          {/* Opinion cards */}
          <div className={presenter ? "space-y-3" : "max-h-48 overflow-y-auto space-y-1.5 scrollbar-hide"}>
            <AnimatePresence mode="popLayout">
              {shownOpinions.map((op) => (
                <motion.div
                  key={op.id}
                  initial={{ opacity: 0, x: op.side === 'for' ? -12 : 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className={`flex ${presenter ? 'items-center gap-3' : 'items-start gap-2.5'} py-2 px-3 rounded-lg ${
                    op.side === 'for' ? 'bg-slate-50 dark:bg-slate-700' : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700'
                  }`}
                >
                  <span
                    className={`${presenter ? 'text-base px-2.5 py-1' : 'text-[10px] px-1.5 py-0.5 mt-0.5'} font-bold rounded shrink-0 ${
                      op.side === 'for'
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {presenter ? (op.side === 'for' ? '찬성' : '반대') : (op.side === 'for' ? '찬' : '반')}
                  </span>
                  <p className={`${presenter ? 'text-[clamp(20px,1.35vw,30px)]' : 'text-sm'} text-slate-700 dark:text-slate-200 leading-relaxed flex-1 [word-break:keep-all]`}>{op.opinion}</p>
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredOpinions.length === 0 && (
              <p className="text-center text-xs text-slate-400 py-4">
                {filter === 'all' ? '아직 작성된 의견이 없습니다' : `${filter === 'for' ? '찬성' : '반대'} 의견이 없습니다`}
              </p>
            )}
          </div>
        </motion.div>
      )}

      {presenter && pages > 1 && <div className="classroom-response-pagination">
        {onPageChange && <button className="presentation-button" aria-label="이전 의견 페이지" disabled={currentPage === 0} onClick={() => onPageChange(currentPage - 1)}><ChevronLeft size={20} /></button>}
        <span>의견 {currentPage + 1} / {pages}</span>
        {onPageChange && <button className="presentation-button" aria-label="다음 의견 페이지" disabled={currentPage === pages - 1} onClick={() => onPageChange(currentPage + 1)}><ChevronRight size={20} /></button>}
      </div>}

      {/* Total count — 발표 화면은 의견 제목 옆에 이미 표시한다 */}
      {!presenter && <div className="text-center text-slate-400 text-sm pt-2 border-t border-slate-100 dark:border-slate-700">
        총 <span className="text-slate-600 dark:text-slate-300 font-semibold">{totalVotes}</span>명 참여
        {opinions.length > 0 && (
          <span className="text-slate-300 ml-2">
            ({opinions.length}개 의견)
          </span>
        )}
      </div>}
    </div>
  );
});
