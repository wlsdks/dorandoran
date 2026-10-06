import { useState, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, ChevronDown, AlertCircle, HelpCircle, Check } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { timeAgo } from '@/lib/utils';

const QuestionItem = memo(function QuestionItem({ q, isSelected, onClick }) {
  const isUrgent = q._type === 'urgent';
  const isDone = isUrgent ? q.read : q.answered;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      role="button"
      aria-label={isDone ? '처리된 질문' : '미처리 질문 — 클릭하여 확인'}
      className={`p-2.5 rounded-lg text-sm transition-colors duration-150 cursor-pointer ${
        isSelected
          ? 'bg-white dark:bg-slate-700 shadow-sm ring-1 ring-slate-300 dark:ring-slate-500'
          : isDone
            ? 'bg-slate-50 dark:bg-slate-800 opacity-60'
            : 'bg-white dark:bg-slate-700 shadow-sm hover:shadow-md'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {!isDone && <div className="w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-slate-100 mt-1.5 shrink-0" />}
        {isDone && <Check size={12} className="text-slate-500 dark:text-slate-300 mt-1 shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-slate-700 dark:text-slate-200 leading-relaxed line-clamp-2">{q.text}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              {isUrgent && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
              {isUrgent ? '긴급' : '수업'}
            </span>
            <span className="text-slate-500 dark:text-slate-300 text-[10px]">
              {isUrgent ? '익명' : q.nickname || '익명'}
            </span>
            <span className="text-slate-500 dark:text-slate-300 text-[10px]">·</span>
            <span className="text-slate-500 dark:text-slate-300 text-[10px]">{timeAgo(q.timestamp)}</span>
            {isDone && !isUrgent && (
              <span className="text-slate-500 dark:text-slate-300 text-[10px] ml-auto">
                {q.answeredByRole === 'staff' ? '스태프 답변' : '강사 답변'}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

function AccordionSection({ icon: Icon, title, count, defaultOpen, badgeVariant, children }) {
  const [collapsed, setCollapsed] = useState(!defaultOpen);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600 transition-colors duration-150"
        aria-expanded={!collapsed}
      >
        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
          <Icon size={14} className="text-slate-500 dark:text-slate-300" />
          {title}
          {count > 0 && (
            <motion.span
              key={count}
              initial={{ scale: 1.3 }}
              animate={{ scale: 1 }}
              className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                badgeVariant === 'red'
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
              }`}
            >
              {count}
            </motion.span>
          )}
        </span>
        <motion.div animate={{ rotate: collapsed ? 0 : 180 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={14} className="text-slate-500 dark:text-slate-300" />
        </motion.div>
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3 space-y-1.5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function StaffQuestionPanel({ urgentList, classList, selectedId, onSelect, staffName }) {
  const { unanswered, myAnswered, otherAnswered } = useMemo(() => {
    const unansweredItems = [];
    const myItems = [];
    const otherItems = [];

    urgentList.forEach((q) => {
      const item = { ...q, _type: 'urgent', _key: `urgent-${q.id}` };
      if (q.read) otherItems.push(item);
      else unansweredItems.push(item);
    });

    classList.forEach((q) => {
      const item = { ...q, _type: 'class', _key: `class-${q.id}` };
      if (q.answered) {
        if (q.answeredBy === staffName || q.answeredByRole === 'staff') myItems.push(item);
        else otherItems.push(item);
      } else {
        unansweredItems.push(item);
      }
    });

    unansweredItems.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    myItems.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    otherItems.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    return { unanswered: unansweredItems, myAnswered: myItems, otherAnswered: otherItems };
  }, [urgentList, classList, staffName]);

  const totalCount = unanswered.length + myAnswered.length + otherAnswered.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} className="text-slate-500 dark:text-slate-300" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">질문</h2>
          {totalCount > 0 && (
            <span className="text-xs text-slate-500 dark:text-slate-300 tabular-nums">{totalCount}</span>
          )}
        </div>
      </div>

      {/* Accordion sections */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {totalCount === 0 ? (
          <div className="flex items-center justify-center py-16 px-5">
            <EmptyState
              title="질문이 없습니다"
              description="학생들의 질문이 여기에 표시됩니다"
              mascotSize="sm"
            />
          </div>
        ) : (
          <div className="space-y-3 p-4">
            {/* Unanswered */}
            <AccordionSection
              icon={AlertCircle}
              title="미답변 질문"
              count={unanswered.length}
              defaultOpen={true}
              badgeVariant="red"
            >
              {unanswered.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-300 text-xs py-1">미답변 질문이 없습니다</p>
              ) : (
                <AnimatePresence>
                  {unanswered.map((q) => (
                    <QuestionItem
                      key={q._key}
                      q={q}
                      isSelected={selectedId === q._key}
                      onClick={() => onSelect({ ...q })}
                    />
                  ))}
                </AnimatePresence>
              )}
            </AccordionSection>

            {/* My answered */}
            {myAnswered.length > 0 && (
              <AccordionSection
                icon={Check}
                title="내가 답변"
                count={myAnswered.length}
                defaultOpen={true}
                badgeVariant="slate"
              >
                <AnimatePresence>
                  {myAnswered.map((q) => (
                    <QuestionItem
                      key={q._key}
                      q={q}
                      isSelected={selectedId === q._key}
                      onClick={() => onSelect({ ...q })}
                    />
                  ))}
                </AnimatePresence>
              </AccordionSection>
            )}

            {/* All answered */}
            {otherAnswered.length > 0 && (
              <AccordionSection
                icon={HelpCircle}
                title="전체 답변 완료"
                count={otherAnswered.length}
                defaultOpen={false}
                badgeVariant="slate"
              >
                <AnimatePresence>
                  {otherAnswered.map((q) => (
                    <QuestionItem
                      key={q._key}
                      q={q}
                      isSelected={selectedId === q._key}
                      onClick={() => onSelect({ ...q })}
                    />
                  ))}
                </AnimatePresence>
              </AccordionSection>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
