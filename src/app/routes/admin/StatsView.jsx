import { useState, useMemo } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import { useRecentQuestions } from '@/hooks/useRecentQuestions';
import { useCountUp } from '@/hooks/useCountUp';
import SummaryCard from './SummaryCard';
import EngagementTab from './EngagementTab';
import { TrendIndicator, DifficultQuestions } from './StatsInsights';
import { CoursePerformance, RecentQuestions } from './StatsCharts';
import { motion } from 'framer-motion';
import { list as stagger } from '@/lib/motion';

const SUB_TABS = [
  { key: 'overview', label: '개요' },
  { key: 'questions', label: '질문 분석' },
  { key: 'engagement', label: '학생 참여도' },
];

function OverviewCards({ totalClasses, totalParticipants, avgActivity, courseCount }) {
  const animClasses = useCountUp(totalClasses, 800);
  const animParticipants = useCountUp(totalParticipants, 1000);
  const animActivity = useCountUp(avgActivity, 1000);

  return (
    <motion.div variants={stagger.container} initial="initial" animate="animate" className="grid grid-cols-3 gap-4 max-sm:gap-3">
      <SummaryCard label="총 클래스" value={animClasses} subtitle={`${courseCount}개 강의`} />
      <SummaryCard label="총 참여자" value={animParticipants} subtitle="누적 접속 수" />
      <SummaryCard label="평균 참여율" value={`${animActivity}%`} progress={avgActivity} />
    </motion.div>
  );
}

function OverviewTab({ stats }) {
  return (
    <div className="space-y-8">
      <OverviewCards
        totalClasses={stats.totalClasses}
        totalParticipants={stats.totalParticipants}
        avgActivity={stats.avgActivity}
        courseCount={stats.courseCount}
      />
      <div>
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">강의별 참여율 추이</h3>
        <CoursePerformance courseData={stats.courseData} />
      </div>
    </div>
  );
}

function QuestionsTab({ questions, difficultQuestions, questionsLoading, courseNames }) {
  const [courseFilter, setCourseFilter] = useState('all');

  return (
    <div className="space-y-6">
      {/* Course filter */}
      {courseNames.length > 1 && (
        <div className="flex gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
          <button
            onClick={() => setCourseFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors duration-150 active:scale-[0.96] whitespace-nowrap shrink-0 ${
              courseFilter === 'all'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'
            }`}
          >
            전체
          </button>
          {courseNames.map((name) => (
            <button
              key={name}
              onClick={() => setCourseFilter(name)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors duration-150 active:scale-[0.96] whitespace-nowrap shrink-0 ${
                courseFilter === name
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">가장 어려웠던 질문</h3>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <DifficultQuestions questions={courseFilter === 'all' ? difficultQuestions : difficultQuestions.filter((q) => (q.courseName || '미분류') === courseFilter)} loading={questionsLoading} />
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">최근 질문</h3>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <RecentQuestions questions={questions} loading={questionsLoading} courseFilter={courseFilter} />
        </div>
      </div>
    </div>
  );
}

export default function StatsView({ sessions }) {
  const [activeSubTab, setActiveSubTab] = useState('overview');

  const stats = useMemo(() => {
    if (!sessions || sessions.length === 0) {
      return { totalClasses: 0, totalParticipants: 0, avgActivity: 0, courseCount: 0, courseData: [] };
    }
    const totalClasses = sessions.length;
    const totalParticipants = sessions.reduce((sum, s) => sum + (s.totalParticipants || s.participantCount), 0);
    const totalActive = sessions.reduce((sum, s) => sum + s.activeCount, 0);
    const avgActivity = totalParticipants > 0 ? Math.round((totalActive / totalParticipants) * 100) : 0;
    const courseNames = new Set(sessions.filter((s) => s.courseName).map((s) => s.courseName));
    const courseCount = courseNames.size || (sessions.length > 0 ? 1 : 0);
    const courseMap = {};
    sessions.forEach((s) => {
      const name = s.courseName || '미분류';
      if (!courseMap[name]) courseMap[name] = [];
      courseMap[name].push(s);
    });
    const courseData = Object.entries(courseMap)
      .map(([name, list]) => {
        list.sort((a, b) => (a.roundNumber || 0) - (b.roundNumber || 0));
        const conducted = list.filter((s) => s.status !== 'setting');
        return {
          name,
          rounds: list.length,
          conductedRounds: conducted.length,
          totalParticipants: list.reduce((sum, s) => sum + (s.totalParticipants || s.participantCount), 0),
          roundDetails: conducted
            .map((s) => ({ roundNumber: s.roundNumber || '\u2014', activityRate: s.activityRate, participantCount: s.totalParticipants || s.participantCount })),
        };
      })
      .filter((c) => c.conductedRounds > 0)
      .sort((a, b) => b.totalParticipants - a.totalParticipants);
    return { totalClasses, totalParticipants, avgActivity, courseCount, courseData };
  }, [sessions]);

  const courseNames = useMemo(() => {
    if (!sessions) return [];
    const names = new Set();
    sessions.forEach((s) => names.add(s.courseName || '미분류'));
    return [...names].sort();
  }, [sessions]);

  const { questions, difficultQuestions, loading: questionsLoading } = useRecentQuestions(sessions);

  if (!sessions || sessions.length === 0) {
    return <EmptyState title="아직 수업 기록이 없습니다" description="클래스를 진행하면 참여율, 질문 통계가 여기에 표시됩니다" mascotSize="md" mood="thinking" className="py-12" />;
  }

  return (
    <div className="space-y-5">
      {/* Sub-tab switcher */}
      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            className={`px-1 pb-2.5 text-sm font-medium transition-colors duration-150 border-b-2 -mb-px ${
              activeSubTab === tab.key
                ? 'border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeSubTab === 'overview' && <OverviewTab stats={stats} />}
      {activeSubTab === 'questions' && (
        <QuestionsTab
          questions={questions}
          difficultQuestions={difficultQuestions}
          questionsLoading={questionsLoading}
          courseNames={courseNames}
        />
      )}
      {activeSubTab === 'engagement' && (
        <EngagementTab sessions={sessions} />
      )}
    </div>
  );
}
