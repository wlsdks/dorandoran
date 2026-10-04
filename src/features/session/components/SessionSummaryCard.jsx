import { useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Target, Hash, Sparkle, Flame, CheckCheck, Zap, Crown } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { useScores } from '@/features/quiz/api/useScores';
import { useAchievements } from '@/features/quiz/api/useAchievements';
import { getParticipantId, getNickname } from '@/lib/participant';
import { isAnswerCorrect } from '@/lib/quiz';
import CelebrationMascot from './CelebrationMascot';

const ACHIEVEMENT_ICONS = { Sparkle, Flame, CheckCheck, Zap, Crown };

/** Choose a fun title based on student performance. */
function getTitle({ answeredCount, correctRate, rank, totalParticipants, bestStreak, totalScore, achievementCount }) {
  if (answeredCount === 0) return '참여해주셔서 감사합니다';
  if (rank === 1 && totalParticipants > 2) return '오늘의 1등!';
  if (achievementCount >= 4) return '업적 마스터!';
  if (rank > 0 && rank <= 3 && totalParticipants > 3) return '상위권 달성!';
  if (bestStreak >= 5) return '연승의 달인';
  if (correctRate >= 90 && answeredCount >= 3) return '완벽에 가까운 정답률';
  if (correctRate >= 70) return '잘 해냈어요!';
  if (totalScore > 0) return '수고했어요!';
  return '오늘도 수업 완료!';
}

/** Single stat item. */
const StatItem = memo(function StatItem({ icon: Icon, label, value, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, delay }}
      className="flex flex-col items-center gap-1 flex-1 min-w-0"
    >
      <Icon size={16} className="text-slate-400" />
      <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">{value}</span>
      <span className="text-[11px] text-slate-400 font-medium">{label}</span>
    </motion.div>
  );
});

/** Achievement item in summary. */
const AchievementItem = memo(function AchievementItem({ achievement, index }) {
  const Icon = ACHIEVEMENT_ICONS[achievement.icon] || Sparkle;
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.5 + index * 0.08 }}
      className="flex items-center gap-2.5 py-2"
    >
      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
        <Icon size={14} className="text-slate-600 dark:text-slate-300" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-tight">{achievement.label}</p>
        <p className="text-xs text-slate-400 leading-tight">{achievement.description}</p>
      </div>
    </motion.div>
  );
});

/** Compute student's session stats from questions + scores. */
function useStudentStats(session, sessionId) {
  const { leaderboard, scores } = useScores(sessionId);
  const participantId = getParticipantId();

  return useMemo(() => {
    const questions = session?.questions || {};
    let answered = 0, correct = 0, gradable = 0;

    let confidentWrong = 0;

    Object.values(questions).forEach((q) => {
      const myVote = q.votes?.[participantId];
      if (myVote) {
        answered++;
        if (q.correctAnswer) {
          gradable++;
          const isCorrect = isAnswerCorrect(q, myVote.value); // 텍스트형 공백·대소문자 무시
          if (isCorrect) correct++;
          if (!isCorrect && myVote.confidence === 'high') confidentWrong++;
        }
      }
    });

    const myScore = scores[participantId];
    const rankIdx = leaderboard.findIndex((e) => e.id === participantId);

    return {
      answeredCount: answered,
      totalQuestions: Object.keys(questions).length,
      correctRate: gradable > 0 ? Math.round((correct / gradable) * 100) : null,
      totalScore: myScore?.total || 0,
      bestStreak: myScore?.bestStreak || myScore?.streak || 0,
      rank: rankIdx >= 0 ? rankIdx + 1 : 0,
      totalParticipants: leaderboard.length,
      confidentWrong,
      scores,
    };
  }, [session?.questions, scores, leaderboard, participantId]);
}

export default function SessionSummaryCard({ session, sessionId, reviewing = false }) {
  const stats = useStudentStats(session, sessionId);
  const { achievements } = useAchievements(session, stats.scores);
  const nickname = getNickname();
  const title = getTitle({ ...stats, achievementCount: achievements.length });

  const hasRank = stats.rank > 0;

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden"
      >
        {/* Header */}
        <div className="pt-6 pb-4 px-5 text-center">
          <CelebrationMascot />
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 25 }}
            className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-3"
          >{title}</motion.p>
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 25 }}
            className="text-sm text-slate-400 mt-1"
          >{nickname}님의 오늘 기록</motion.p>
          {session?.courseName && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, type: 'spring', stiffness: 300, damping: 25 }} className="mt-2">
              <Badge variant="neutral">
                {session.courseName} {session.roundNumber ? `${session.roundNumber}차` : ''}
              </Badge>
            </motion.div>
          )}
        </div>

        {/* Stats grid */}
        <div className="px-5 pb-4">
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
            <div className="flex items-start justify-around">
              <StatItem icon={Hash} label="참여" value={`${stats.answeredCount}/${stats.totalQuestions}`} delay={0.25} />
              {stats.correctRate !== null && (
                <StatItem icon={Target} label="정답률" value={`${stats.correctRate}%`} delay={0.3} />
              )}
              {stats.totalScore > 0 && (
                <StatItem icon={Trophy} label="점수" value={stats.totalScore} delay={0.35} />
              )}
            </div>
          </div>
        </div>

        {/* Rank badge */}
        {hasRank && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 400, damping: 22 }}
            className="px-5 pb-4 flex justify-center"
          >
            <Badge variant="primary">
              <Trophy size={12} className="mr-1" />
              {stats.totalParticipants}명 중 {stats.rank}위
            </Badge>
          </motion.div>
        )}

        {/* Confidence insight */}
        {stats.confidentWrong > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.42 }}
            className="px-5 pb-2"
          >
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
              확신했지만 틀린 문제가 <span className="font-semibold text-slate-700 dark:text-slate-200">{stats.confidentWrong}개</span> 있어요 — 복습해보세요!
            </p>
          </motion.div>
        )}

        {/* Achievements */}
        {achievements.length > 0 && (
          <div className="px-5 pb-5">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, type: 'spring', stiffness: 300, damping: 25 }}
            >
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">획득한 업적</p>
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl px-3.5 py-1 divide-y divide-slate-100 dark:divide-slate-600">
                {achievements.map((a, i) => (
                  <AchievementItem key={a.id} achievement={a} index={i} />
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>

      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
        className="text-center text-xs text-slate-400"
      >{reviewing ? '하단에서 질문이나 채팅을 보낼 수 있어요' : '오늘도 수고하셨습니다!'}</motion.p>
    </div>
  );
}
