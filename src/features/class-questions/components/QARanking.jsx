import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, MessageSquare, Crown, Trophy, Medal, Award } from 'lucide-react';
import { useQAStats } from '@/features/class-questions/api/useQAStats';
import EmptyState from '@/components/ui/EmptyState';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';

const MEDAL_META = [
  { Icon: Trophy, color: 'text-amber-500' },     // 1등 gold
  { Icon: Medal, color: 'text-slate-400' },      // 2등 silver
  { Icon: Award, color: 'text-amber-700 dark:text-amber-600' }, // 3등 bronze
];

function RankRow({ entry, rank, field, presenter = false }) {
  const value = field === 'questions' ? entry.questions : field === 'answers' ? entry.answers : entry.total;
  const isPodium = rank < 3;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, delay: rank * 0.04 }}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl ${presenter ? "min-h-16" : ""} transition-colors duration-150 ${
        isPodium
          ? 'bg-white dark:bg-slate-800 shadow-sm'
          : 'bg-slate-50/50 dark:bg-slate-800/50'
      }`}
    >
      <span className="w-8 flex items-center justify-center shrink-0">
        {isPodium ? (() => {
          const { Icon, color } = MEDAL_META[rank];
          return <Icon size={presenter ? 28 : 18} className={color} />;
        })() : (
          <span className={`${presenter ? "text-2xl" : "text-sm"} font-bold text-slate-400 tabular-nums`}>{rank + 1}</span>
        )}
      </span>
      <span className={`flex-1 truncate ${isPodium ? 'font-bold text-slate-900 dark:text-slate-100' : 'font-medium text-slate-700 dark:text-slate-300'} ${presenter ? 'text-2xl md:text-3xl' : 'text-sm'}`}>
        {entry.nickname}
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={`tabular-nums font-bold ${presenter ? 'text-3xl text-slate-100' : isPodium ? 'text-lg text-slate-900 dark:text-slate-100' : 'text-sm text-slate-600 dark:text-slate-300'}`}>
          {value}
        </span>
        <span className={presenter ? "text-lg text-slate-300" : "text-[10px] text-slate-400"}>
          {field === 'questions' ? '질문' : field === 'answers' ? '답변' : '활동'}
        </span>
      </div>
    </motion.div>
  );
}

export default function QARanking({ sessionId, presenter = false, readOnly = false }) {
  const { totalRanking, questionRanking, answerRanking, totalQuestions, totalAnswers, loading } = useQAStats(sessionId);
  const [tab, setTab] = useState('total');

  const tabs = [
    { key: 'total', label: '종합', icon: Crown },
    { key: 'questions', label: '질문왕', icon: HelpCircle },
    { key: 'answers', label: '답변왕', icon: MessageSquare },
  ];

  const field = readOnly ? 'total' : tab;
  const ranking = field === 'questions' ? questionRanking : field === 'answers' ? answerRanking : totalRanking;
  const [displayPage, setDisplayPage] = useState(0);
  const displayPages = Math.max(1, Math.ceil(Math.min(ranking.length, 15) / 6));
  useEffect(() => {
    if (!presenter || displayPages < 2) return;
    const timer = setInterval(() => setDisplayPage(page => (page + 1) % displayPages), 10000);
    return () => clearInterval(timer);
  }, [presenter, displayPages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="flex items-center gap-2 text-slate-400">
          <div className="w-5 h-5 border-2 border-slate-300 dark:border-slate-600 border-t-slate-500 dark:border-t-slate-400 rounded-full animate-spin" />
          <span className="text-sm">불러오는 중...</span>
        </div>
      </div>
    );
  }

  if (totalRanking.length === 0) {
    if (presenter) return <div className="paper-surface max-w-[1000px] text-center py-10 space-y-5">
      <DoranDoranMascot size="lg" mood="waiting" />
      <h2 className="classroom-question-title font-bold">함께 질문하고 답해보세요</h2>
      <p className="text-2xl text-slate-300">질문과 답변이 쌓이면 참여 랭킹을 보여드립니다</p>
    </div>;
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <EmptyState
          title="Q&A 활동이 없습니다"
          description="학생들이 질문하거나 답변하면 랭킹이 표시됩니다"
          mascotSize="md"
          mood="waiting"
        />
      </div>
    );
  }

  return (
    <div className={`w-full mx-auto ${presenter ? "paper-surface max-w-[1100px]" : "max-w-lg"}`} onClick={(e) => e.stopPropagation()}>
      {/* Header */}
      <div className="text-center mb-5">
        <h2 className={`${presenter ? "text-3xl md:text-4xl" : "text-2xl md:text-3xl"} font-bold tracking-tight text-slate-900 dark:text-slate-100`}>
          Q&A 랭킹
        </h2>
        <p className={`${presenter ? "text-xl text-slate-300" : "text-sm text-slate-400 dark:text-slate-500"} mt-1`}>
          질문 {totalQuestions}개 · 답변 {totalAnswers}개
        </p>
      </div>

      {/* Tabs */}
      {!readOnly && <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 mb-5">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-lg transition-colors duration-150 ${
                tab === t.key
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>}

      {/* Ranking list */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="space-y-1.5"
        >
          {ranking.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-8">
              {tab === 'questions' ? '아직 질문한 학생이 없습니다' : '아직 답변한 학생이 없습니다'}
            </p>
          ) : (
            ranking.slice(presenter ? (displayPage % displayPages) * 6 : 0, presenter ? Math.min((displayPage % displayPages) * 6 + 6, 15) : 15).map((entry, i) => (
              <RankRow key={entry.id} entry={entry} rank={presenter ? (displayPage % displayPages) * 6 + i : i} field={field} presenter={presenter} />
            ))
          )}
        </motion.div>
      </AnimatePresence>
      {presenter && displayPages > 1 && <p className="mt-4 text-center text-lg text-slate-300">순위 {displayPage % displayPages + 1} / {displayPages} · 10초마다 다음 순위</p>}
    </div>
  );
}
