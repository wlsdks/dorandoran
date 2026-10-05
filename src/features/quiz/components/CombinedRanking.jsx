import { memo, useMemo, useState, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { Medal, Search, Crown, Award } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import { isAnswerCorrect } from '@/lib/quiz';

const ConfettiBurst = lazy(() => import('@/components/ui/ConfettiBurst'));

const SPRING_BOUNCY = { type: 'spring', stiffness: 400, damping: 22 };

// 포디움 원 안 이니셜 — 코드포인트 단위(이모지 안전), 최대 2글자.
const podiumInitials = (name) => (Array.from(name || '').slice(0, 2).join('').toUpperCase() || '?');

const PODIUM_STYLES = [
  { bg: 'bg-amber-400', ring: 'ring-amber-300', text: 'text-amber-900', label: '1st', icon: Crown },
  { bg: 'bg-slate-300', ring: 'ring-slate-200', text: 'text-slate-700', label: '2nd', icon: Award },
  { bg: 'bg-amber-600', ring: 'ring-amber-500', text: 'text-amber-100', label: '3rd', icon: Award },
];

export default memo(function CombinedRanking({ session }) {
  const [search, setSearch] = useState('');

  const ranking = useMemo(() => {
    const questions = session?.questions || {};
    const scoreMap = Object.create(null);

    Object.values(questions).forEach((q) => {
      if (!q.correctAnswer) return;
      const votes = q.votes || {};

      Object.entries(votes).forEach(([pid, vote]) => {
        const isCorrect = isAnswerCorrect(q, vote.value); // 텍스트형은 대소문자·띄어쓰기 무시, 객관식은 정확 일치
        if (!scoreMap[pid]) {
          scoreMap[pid] = { id: pid, nickname: vote.nickname || `참여자 ${pid.slice(0, 4)}`, correct: 0, answered: 0 };
        }
        scoreMap[pid].answered++;
        if (isCorrect) scoreMap[pid].correct++;
      });
    });

    return Object.values(scoreMap)
      .filter(s => s.correct > 0)
      .sort((a, b) => b.correct - a.correct || a.answered - b.answered)
      .map((s, i) => ({ ...s, rank: i + 1 }));
  }, [session?.questions]);

  const totalQuestions = useMemo(() => {
    return Object.values(session?.questions || {}).filter(q => q.correctAnswer).length;
  }, [session?.questions]);

  if (!session?.questions) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-slate-400 dark:text-slate-500 text-sm">데이터를 불러오는 중...</p>
      </div>
    );
  }

  const podium = ranking.slice(0, 3);
  const rest = search.trim()
    ? ranking.filter(e => e.rank > 3 && e.nickname.toLowerCase().includes(search.trim().toLowerCase()))
    : ranking.slice(3);

  // overflow-hidden: 발표모드(items-center 부모)에서 maxHeight를 뚫고 리스트가 페이지를
  // 1만px+로 늘리던 문제 차단 — 4위 이하는 내부 스크롤러가 담당
  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col relative pt-14 overflow-hidden" style={{ maxHeight: '85vh' }}>
      {/* 폭죽 1회 */}
      <Suspense fallback={null}><ConfettiBurst /></Suspense>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING_BOUNCY}
        className="text-center space-y-2 mb-6 shrink-0"
      >
        <DoranDoranMascot size="md" mood="happy" className="mx-auto mb-2" />
        <div className="flex items-center justify-center gap-2">
          <Medal size={28} className="text-amber-500" />
          <h3 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">합산 랭킹</h3>
        </div>
        <p className="text-sm text-slate-400 dark:text-slate-500">총 {totalQuestions}개 문항 · 정답자 {ranking.length}명</p>
      </motion.div>

      {/* 포디움 */}
      {podium.length > 0 && (
        <div className="flex items-end justify-center gap-3 md:gap-5 mb-6 shrink-0">
          {/* 2등 (왼쪽) */}
          {podium[1] && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING_BOUNCY, delay: 0.4 }}
              className="flex flex-col items-center"
            >
              <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full ${PODIUM_STYLES[1].bg} ring-4 ${PODIUM_STYLES[1].ring} flex items-center justify-center mb-2 shadow-lg`}>
                <span className={`text-xl md:text-2xl font-black ${PODIUM_STYLES[1].text}`}>{podiumInitials(podium[1].nickname)}</span>
              </div>
              <span className="text-sm md:text-base font-bold text-slate-700 dark:text-slate-200 truncate max-w-[100px]">{podium[1].nickname}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">{podium[1].correct}/{totalQuestions}</span>
              <div className={`mt-2 w-20 md:w-24 h-16 md:h-20 rounded-t-xl ${PODIUM_STYLES[1].bg} flex items-center justify-center shadow-inner`}>
                <span className={`text-2xl md:text-3xl font-black ${PODIUM_STYLES[1].text}`}>2</span>
              </div>
            </motion.div>
          )}

          {/* 1등 (가운데, 가장 높음) */}
          {podium[0] && (
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ...SPRING_BOUNCY, delay: 0.2 }}
              className="flex flex-col items-center -mt-4"
            >
              <motion.div
                animate={{ rotate: [0, -5, 5, -3, 0] }}
                transition={{ duration: 1.5, delay: 1, repeat: 1 }}
              >
                <Crown size={28} className="text-amber-400 mb-1" />
              </motion.div>
              <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full ${PODIUM_STYLES[0].bg} ring-4 ${PODIUM_STYLES[0].ring} flex items-center justify-center mb-2 shadow-xl`}>
                <span className={`text-2xl md:text-3xl font-black ${PODIUM_STYLES[0].text}`}>{podiumInitials(podium[0].nickname)}</span>
              </div>
              <span className="text-base md:text-lg font-bold text-slate-900 dark:text-slate-100 truncate max-w-[120px]">{podium[0].nickname}</span>
              <span className="text-sm text-slate-400 dark:text-slate-500 tabular-nums">{podium[0].correct}/{totalQuestions}</span>
              <div className={`mt-2 w-24 md:w-28 h-20 md:h-24 rounded-t-xl ${PODIUM_STYLES[0].bg} flex items-center justify-center shadow-inner`}>
                <span className={`text-3xl md:text-4xl font-black ${PODIUM_STYLES[0].text}`}>1</span>
              </div>
            </motion.div>
          )}

          {/* 3등 (오른쪽) */}
          {podium[2] && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING_BOUNCY, delay: 0.6 }}
              className="flex flex-col items-center"
            >
              <div className={`w-14 h-14 md:w-16 md:h-16 rounded-full ${PODIUM_STYLES[2].bg} ring-4 ${PODIUM_STYLES[2].ring} flex items-center justify-center mb-2 shadow-lg`}>
                <span className={`text-lg md:text-xl font-black ${PODIUM_STYLES[2].text}`}>{podiumInitials(podium[2].nickname)}</span>
              </div>
              <span className="text-sm md:text-base font-bold text-slate-700 dark:text-slate-200 truncate max-w-[100px]">{podium[2].nickname}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">{podium[2].correct}/{totalQuestions}</span>
              <div className={`mt-2 w-20 md:w-24 h-12 md:h-16 rounded-t-xl ${PODIUM_STYLES[2].bg} flex items-center justify-center shadow-inner`}>
                <span className={`text-xl md:text-2xl font-black ${PODIUM_STYLES[2].text}`}>3</span>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Search */}
      {ranking.length > 3 && (
        <div className="relative mb-3 shrink-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="학생 이름 검색..."
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
        </div>
      )}

      {/* 4위 이하 — 스크롤. 마지막 행이 둥근 모서리에 반쯤 잘려 이상하게 보이던 것 → 하단 페이드로 자연스럽게 */}
      {rest.length > 0 && (
        <div className="relative flex-1 min-h-0">
          <div className="h-full overflow-y-auto bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm pb-3">
            {rest.map((entry, i) => (
              <div key={entry.id} className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? 'border-t border-slate-100 dark:border-slate-700' : ''}`}>
                <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 flex items-center justify-center text-xs font-bold shrink-0">
                  {entry.rank}
                </span>
                <Avatar name={entry.nickname} size="xs" />
                <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{entry.nickname}</span>
                <div className="text-right shrink-0">
                  <span className="text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums">{entry.correct}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 ml-0.5">/{totalQuestions}</span>
                </div>
              </div>
            ))}
            {rest.length === 0 && search && (
              <div className="py-6 text-center text-xs text-slate-400">검색 결과 없음</div>
            )}
          </div>
          {/* 하단 페이드 오버레이 — 스크롤 중 잘리는 행을 배경으로 부드럽게 */}
          <div className="pointer-events-none absolute bottom-0 inset-x-0 h-10 rounded-b-2xl bg-gradient-to-t from-white dark:from-slate-800 to-transparent" />
        </div>
      )}
    </div>
  );
});
