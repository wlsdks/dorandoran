/* eslint-disable react-refresh/only-export-components -- getPresenterGridConfig helper와 SubmissionGrid 컴포넌트 의도적 collocation (그리드 config는 컴포넌트 전용) */
import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { spring } from '@/lib/motion';

/**
 * 제출 수별 프레젠터 그리드 구성 — 뒷자리 가독성 vs 전체 조망 균형.
 * 소규모(1~3): 큰 카드로 주목. 중규모(4~12): 3~4열. 대규모(13+): 5~6열로 전체 조망.
 *
 * 구간별 카드 종횡비/최대폭 — 뷰포트 초과하면 grid wrapper가 overflow-y-auto로 스크롤 허용.
 * 1080p 기준 나머지 공간 ~820px. 카드 크기는 "너무 크지 않게" 중간 톤.
 */
export function getPresenterGridConfig(count) {
  if (count <= 1) return { cols: 'grid-cols-1', gap: 'gap-6', maxW: 'max-w-sm', pad: 'p-4', name: 'text-xl', title: 'text-sm', aspect: 'aspect-[4/3]' };
  if (count <= 2) return { cols: 'grid-cols-2', gap: 'gap-4', maxW: 'max-w-2xl', pad: 'p-3', name: 'text-lg', title: 'text-xs', aspect: 'aspect-[4/3]' };
  if (count <= 6) return { cols: 'grid-cols-3', gap: 'gap-3', maxW: 'max-w-3xl', pad: 'p-2.5', name: 'text-sm', title: 'text-xs', aspect: 'aspect-[3/2]' };
  if (count <= 12) return { cols: 'grid-cols-4', gap: 'gap-3', maxW: 'max-w-5xl', pad: 'p-2', name: 'text-sm', title: 'text-[11px]', aspect: 'aspect-[3/2]' };
  if (count <= 30) return { cols: 'grid-cols-5', gap: 'gap-2.5', maxW: 'max-w-6xl', pad: 'p-2', name: 'text-xs', title: 'text-[11px]', aspect: 'aspect-[16/9]' };
  return { cols: 'grid-cols-6', gap: 'gap-2', maxW: 'max-w-[88rem]', pad: 'p-1.5', name: 'text-[11px]', title: 'text-[10px]', aspect: 'aspect-[16/9]' };
}

const SubmissionGrid = memo(function SubmissionGrid({ submissions, isPresenter }) {
  const count = submissions.length;
  const presenterCfg = isPresenter ? getPresenterGridConfig(count) : null;

  const gridCls = isPresenter
    ? `grid ${presenterCfg.cols} ${presenterCfg.gap} ${presenterCfg.maxW} mx-auto`
    : 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3';

  return (
    <div className={gridCls}>
      <AnimatePresence>
        {submissions.map((s) => (
          <motion.div
            key={s.id}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={spring.default}
            className="rounded-xl overflow-hidden border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800"
          >
            {(() => {
              // 프레젠터는 count에 따라 aspect 동적, 관리자 그리드(isPresenter=false)는 square 유지
              const asp = isPresenter ? presenterCfg.aspect : 'aspect-square';
              if (s.imageUrl) return <img src={s.imageUrl} alt={`${s.name} 제출물`} loading="lazy" className={`w-full ${asp} object-cover`} />;
              if (s.code) return (
                <div className={`w-full ${asp} bg-slate-900 flex flex-col items-center justify-center text-slate-400 gap-1`}>
                  <span className="text-2xl font-mono">{'</>'}</span>
                  <span className="text-[10px] uppercase tracking-wider">HTML 코드</span>
                </div>
              );
              return (
                <div className={`w-full ${asp} bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-300 text-xs`}>
                  제출물 없음
                </div>
              );
            })()}
            <div className={isPresenter ? presenterCfg.pad : 'p-2'}>
              <p className={`font-semibold text-slate-700 dark:text-slate-200 truncate ${isPresenter ? presenterCfg.name : 'text-xs'}`}>{s.name}</p>
              {s.title && <p className={`text-slate-400 truncate ${isPresenter ? presenterCfg.title : 'text-[11px]'}`}>{s.title}</p>}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
});

export default SubmissionGrid;
