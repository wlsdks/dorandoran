import { memo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

/**
 * CollapsibleSection — 탭/리스트 허브 카드에 "접기/펼치기" 껍데기를 씌우는 공통 래퍼.
 *
 * 설계 근거:
 *  - 우측 사이드바에 정보 섹션이 많으면 세로 스크롤이 길어져 강사가 원하는 곳을 못 찾음
 *  - 탭 UI는 같은 카테고리 안 전환엔 좋지만 카드 자체가 접혀야 스크롤 길이를 조절할 수 있음
 *  - 접혔을 때는 "새 알림이 있는지" 한눈에 보이도록 summary(요약 카운트)를 헤더에 노출
 *
 * 기본값은 open=true. 헤더 클릭으로 토글. Framer motion height 애니메이션(200ms).
 */
export default memo(function CollapsibleSection({
  title,
  summary = null,
  defaultOpen = true,
  attention = false,
  autoOpenKeys = [],
  children,
  className = '',
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [dismissedKeys, setDismissedKeys] = useState([]);
  const unseenRequest = autoOpenKeys.some(key => !dismissedKeys.includes(key));
  const expanded = open || unseenRequest;
  useEffect(() => { if (unseenRequest) setOpen(true); }, [unseenRequest]);

  function toggle() {
    if (expanded) {
      setOpen(false);
      setDismissedKeys(autoOpenKeys);
    } else setOpen(true);
  }

  return (
    <div className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden ${className}`}>
      <button
        onClick={toggle}
        aria-expanded={expanded}
        aria-label={`${title} ${expanded ? '접기' : '펼치기'}`}
        className="w-full min-h-11 flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600 transition-colors duration-150"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-sm font-semibold tracking-tight text-slate-600 dark:text-slate-300 shrink-0">
            {title}
          </span>
          {/* attention(예: 긴급 질문 도착)일 때 펄싱 dot으로 접힌 상태에서도 시선 유도 */}
          {attention && (
            <span
              aria-hidden="true"
              className="w-1.5 h-1.5 rounded-full bg-red-500 dark:bg-red-400 animate-pulse shrink-0"
            />
          )}
          {summary && (
            <span className={`text-[11px] truncate min-w-0 flex-1 ${attention ? 'text-red-500 dark:text-red-400 font-semibold' : 'text-slate-400 dark:text-slate-500'}`}>
              {summary}
            </span>
          )}
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={14} className="text-slate-400 shrink-0" />
        </motion.div>
      </button>

      {/* 접혀도 입력 중인 메모와 선택한 탭 상태를 보존한다. 숨긴 도구는 포커스 대상에서 제외. */}
      <motion.div initial={false}
        animate={{ height: expanded ? 'auto' : 0, opacity: expanded ? 1 : 0 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        inert={!expanded} aria-hidden={!expanded}
        className={`overflow-hidden ${expanded ? 'border-t border-slate-100 dark:border-slate-700' : ''}`}>
        {children}
      </motion.div>
    </div>
  );
});
