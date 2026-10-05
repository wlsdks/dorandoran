import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Hash, Target, Trophy, Flame, Copy, Check, CheckCircle, XCircle, Minus, Award, CheckCheck, Zap, Crown } from 'lucide-react';
import { useReportData } from '@/features/report/api/useReportData';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import LearningReportCard from '@/features/report/components/LearningReportCard';

const ACHIEVEMENT_ICONS = { Award, Flame, CheckCheck, Zap, Crown };

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

function StatCard({ icon: Icon, label, value, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, delay }}
      className="flex flex-col items-center gap-1.5 flex-1 min-w-0 py-4"
    >
      <Icon size={18} className="text-slate-400" />
      <span className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">{value}</span>
      <span className="text-xs text-slate-400 font-medium">{label}</span>
    </motion.div>
  );
}

const ACTIVITY_LABELS = {
  material: '수업 자료',
  submission: '개별 제출 활동',
  mode: '진행 활동',
  unknown: '활동 유형 확인 필요',
};

function QuestionRow({ q, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18, delay: 0.1 + Math.min(index, 5) * 0.025 }}
      className="flex items-start gap-3 py-3"
    >
      {/* Result icon */}
      <div className="mt-0.5 shrink-0">
        {q.isCorrect === true && <CheckCircle size={18} className="text-slate-900 dark:text-slate-100" />}
        {q.isCorrect === false && <XCircle size={18} className="text-slate-300 dark:text-slate-600" />}
        {q.isCorrect === null && <Minus size={16} className="text-slate-300 dark:text-slate-600" />}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">{q.title}</p>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <Badge variant="neutral" className="shrink-0 whitespace-nowrap">{q.typeLabel === 'modeCard' ? '진행 카드' : q.typeLabel}</Badge>
          {q.participationKind !== 'response' ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">{ACTIVITY_LABELS[q.participationKind]}</span>
          ) : !q.answered && (
            <span className="shrink-0 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">미응답</span>
          )}
        </div>
        {q.answered && <p className={`mt-2 break-words text-sm leading-relaxed ${q.isCorrect === true ? 'text-slate-700 dark:text-slate-300 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>내 답: {q.myAnswer}</p>}
        {q.correctAnswer && q.isCorrect !== true && (
          <p className="mt-1.5 break-words text-sm leading-relaxed text-slate-600 dark:text-slate-300">정답: {q.correctAnswer}</p>
        )}
      </div>
    </motion.div>
  );
}

export default function ReportPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('s');
  const participantId = searchParams.get('p');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const copyTimer = useRef(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; clearTimeout(copyTimer.current); };
  }, []);

  const { stats, achievements, loading, authorized, error } = useReportData(sessionId, participantId);

  if (!sessionId || !participantId) {
    return (
      <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="flex flex-col items-center text-center space-y-4 max-w-sm">
          <DoranDoranMascot size="lg" mood="thinking" />
          <div className="space-y-1.5">
            <p className="text-slate-700 dark:text-slate-200 text-base font-semibold">유효하지 않은 리포트 링크입니다</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm leading-relaxed">세션 종료 화면의 "내 학습 리포트" 버튼을 눌러주세요</p>
          </div>
          <a href="/" className="mt-2 px-5 py-2.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors">
            홈으로 돌아가기
          </a>
        </div>
      </div>
    );
  }

  if (!authorized || error) return <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6">
    <div className="max-w-sm text-center space-y-4"><DoranDoranMascot size="lg" mood="waiting" />
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">이 리포트를 확인할 수 없습니다</h1>
      <p className="text-base text-slate-500 dark:text-slate-300">수업에 참여한 기기에서 내 학습 리포트를 열어주세요.</p>
      <a href={`/?s=${encodeURIComponent(sessionId)}`} className="min-h-12 inline-flex items-center justify-center px-5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900">수업으로 돌아가기</a>
    </div>
  </div>;

  if (loading) {
    return (
      <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center gap-4">
        <DoranDoranMascot size="md" mood="thinking" />
        <p className="text-sm text-slate-400">리포트 불러오는 중...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <DoranDoranMascot size="lg" mood="thinking" />
          <p className="text-slate-500 text-base">세션을 찾을 수 없습니다</p>
        </div>
      </div>
    );
  }

  const title = getTitle({ ...stats, achievementCount: achievements.length });
  const reportUrl = window.location.href;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(reportUrl);
      if (!mounted.current) return;
      setCopyError('');
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      if (!mounted.current) return;
      setCopyError('링크를 복사하지 못했어요. 브라우저 주소를 직접 복사해주세요.');
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
        <div className="max-w-xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <DoranDoranMascot size="xs" />
            <span className="text-base font-bold text-slate-900 dark:text-slate-100">도란도란</span>
          </div>
          <button
            onClick={handleCopy}
            className="min-h-11 min-w-11 flex items-center justify-center gap-1.5 px-2 text-sm text-slate-500 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-200 transition-colors duration-150"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? '복사됨' : '내 링크 복사'}
          </button>
        </div>
      </div>

      {copyError && <p role="alert" className="max-w-xl mx-auto px-5 pt-3 text-sm text-slate-600 dark:text-slate-300">{copyError}</p>}

      <div className="max-w-xl mx-auto px-5 py-8 space-y-6">
        {/* Title section */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="text-center space-y-3"
        >
          {stats.nickname && (
            <div className="flex justify-center">
              <div className="flex items-center gap-2.5 bg-white dark:bg-slate-800 rounded-full py-1.5 pl-1.5 pr-4 shadow-sm">
                <Avatar name={stats.nickname} size="sm" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{stats.nickname}</span>
              </div>
            </div>
          )}
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">{title}</h1>
          <div className="flex items-center justify-center gap-2">
            {stats.courseName && (
              <Badge variant="primary">{stats.courseName} {stats.roundNumber ? `${stats.roundNumber}차` : ''}</Badge>
            )}
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden"
        >
          <div className="flex items-start divide-x divide-slate-100 dark:divide-slate-700">
            <StatCard icon={Hash} label="응답 참여" value={`${stats.answeredCount}/${stats.totalQuestions}`} delay={0.15} />
            {stats.correctRate !== null && (
              <StatCard icon={Target} label="정답률" value={`${stats.correctRate}%`} delay={0.2} />
            )}
            {stats.totalScore > 0 && (
              <StatCard icon={Trophy} label="점수" value={stats.totalScore} delay={0.25} />
            )}
          </div>
          <p className="px-5 pb-4 text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">답변할 수 있는 질문을 기준으로 계산해요. 수업 자료와 개별 제출 활동은 제외합니다.</p>

          {/* Rank */}
          {stats.rank > 0 && (
            <div className="border-t border-slate-100 dark:border-slate-700 px-5 py-3 flex items-center justify-center gap-2">
              <Trophy size={14} className="text-slate-400" />
              <span className="text-sm text-slate-600 dark:text-slate-300">
                <span className="font-bold">{stats.totalParticipants}</span>명 중 <span className="font-bold">{stats.rank}</span>위
              </span>
              {stats.bestStreak > 0 && (
                <>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <Flame size={14} className="text-slate-400" />
                  <span className="text-sm text-slate-600 dark:text-slate-300">최고 <span className="font-bold">{stats.bestStreak}</span>연속</span>
                </>
              )}
            </div>
          )}
        </motion.div>

        {/* Achievements */}
        {achievements.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-5"
          >
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">획득한 업적</p>
            <div className="space-y-2.5">
              {achievements.map((a, i) => {
                const Icon = ACHIEVEMENT_ICONS[a.icon] || Award;
                return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.06 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                      <Icon size={15} className="text-slate-600 dark:text-slate-300" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{a.label}</p>
                      <p className="text-xs text-slate-400">{a.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* AI Personal Learning Report */}
        <LearningReportCard stats={stats} />

        {/* Question-by-question breakdown */}
        {stats.questionDetails.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-5"
          >
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">질문별 기록</p>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {stats.questionDetails.map((q, i) => (
                <QuestionRow key={q.id} q={q} index={i} />
              ))}
            </div>
          </motion.div>
        )}

        {/* Share CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center space-y-3 pt-2"
        >
          <button
            onClick={handleCopy}
            className="min-h-12 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-semibold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors duration-150"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? '링크 복사됨!' : '리포트 링크 복사'}
          </button>
          <p className="text-xs text-slate-400">수업에 참여한 이 기기에서 링크를 열어 확인하세요</p>
        </motion.div>

        {/* Footer */}
        <div className="text-center pt-4 pb-8">
          <p className="text-xs text-slate-300 dark:text-slate-600">도란도란 — 실시간 강의 참여 플랫폼</p>
        </div>
      </div>
    </div>
  );
}
