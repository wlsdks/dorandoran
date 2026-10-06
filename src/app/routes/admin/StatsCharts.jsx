import { motion } from 'framer-motion';
import EmptyState from '@/components/ui/EmptyState';
import { MessageSquare, Users } from 'lucide-react';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import { QUESTION_TYPE_MAP } from '@/lib/question-types';
import { TrendIndicator, MiniTrendLine } from './StatsInsights';

const stagger = {
  container: { animate: { transition: { staggerChildren: 0.04 } } },
  item: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } },
  },
};

export function CoursePerformance({ courseData }) {
  if (courseData.length === 0) {
    return <EmptyState title="강의 데이터가 없습니다" description="강의를 진행하면 참여율 추이가 표시됩니다" mascotSize="sm" mood="thinking" className="py-8" />;
  }
  return (
    <motion.div variants={stagger.container} initial="initial" animate="animate" className="space-y-4">
      {courseData.map((course) => (
        <motion.div key={course.name} variants={stagger.item} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 max-sm:p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-slate-900 dark:text-slate-100 tracking-tight">{course.name}</h4>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <TrendIndicator roundDetails={course.roundDetails} />
              <span><span className="font-semibold text-slate-600 dark:text-slate-300">{course.conductedRounds}</span>차수</span>
              <span className="max-sm:hidden"><span className="font-semibold text-slate-600 dark:text-slate-300">{course.totalParticipants}</span>명</span>
            </div>
          </div>
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              {course.roundDetails.map((round, idx) => (
                <div key={`${round.roundNumber}-${idx}`} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-8 shrink-0 font-medium">{round.roundNumber}차</span>
                  <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <motion.div className="h-full w-full bg-slate-700 dark:bg-slate-300 rounded-full" style={{ originX: 0 }}
                      initial={{ scaleX: 0 }} animate={{ scaleX: Math.min(1, round.activityRate / 100) }}
                      transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.15 }} />
                  </div>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 w-10 text-right">{round.activityRate}%</span>
                </div>
              ))}
            </div>
            <MiniTrendLine roundDetails={course.roundDetails} />
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

export function RecentQuestions({ questions, loading, courseFilter }) {
  const filtered = courseFilter === 'all'
    ? questions
    : questions.filter((q) => (q.courseName || '미분류') === courseFilter);

  if (loading) {
    return <div className="flex flex-col items-center justify-center py-10 gap-3"><DoranDoranMascot size="sm" mood="thinking" /><p className="text-sm text-slate-400">불러오는 중...</p></div>;
  }
  if (filtered.length === 0) {
    return <EmptyState title="최근 질문이 없습니다" description="질문을 만들고 수업을 진행해보세요" mascotSize="sm" mood="thinking" className="py-8" />;
  }
  return (
    <motion.div variants={stagger.container} initial="initial" animate="animate" className="space-y-1">
      {filtered.map((q) => {
        const typeInfo = QUESTION_TYPE_MAP[q.type] || { label: q.type, icon: MessageSquare };
        const Icon = typeInfo.icon;
        const noResponses = q.responseCount === 0;
        return (
          <motion.div key={`${q.sessionId}-${q.qId}`} variants={stagger.item} className={`flex items-center gap-3 py-2.5 ${noResponses ? 'opacity-40' : ''}`}>
            <Icon size={16} className="text-slate-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{q.title}</p>
              <p className="text-xs text-slate-400 mt-0.5">{q.courseName || '미분류'}</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
              <Users size={12} />
              <span className="font-medium text-slate-500 dark:text-slate-400">{q.responseCount}</span>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
