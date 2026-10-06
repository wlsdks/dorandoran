import { useMemo } from 'react';
import { Medal, Monitor } from 'lucide-react';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import { isAnswerCorrect } from '@/lib/quiz';
import { getParticipantId } from '@/lib/participant';

/**
 * 학생용 합산 랭킹 스펙테이터 카드.
 *
 * 합산 랭킹은 전자칠판(발표자)에서 전체 순위를 보여주는 결과 모드다.
 * 학생 useSession은 성능(300명 fan-out 방지)을 위해 votes를 "본인 것만" 남기므로,
 * 학생 단말에서 CombinedRanking을 그대로 렌더하면 전원 votes가 없어 "정답자 1명·나 1위"처럼
 * 잘못된 전체 순위가 나온다. 따라서 학생에겐 "본인의 정답 수(정확히 계산 가능)"만 보여주고
 * 전체 순위는 전자칠판을 안내한다.
 */
export default function StudentResultCard({ session }) {
  const { correct, total } = useMemo(() => {
    const pid = getParticipantId();
    const questions = session?.questions || {};
    let correct = 0;
    let total = 0;
    Object.values(questions).forEach((q) => {
      if (!q || !q.correctAnswer) return; // 정답이 있는 문항(퀴즈/정답형)만 집계
      total += 1;
      const myVote = q.votes?.[pid];
      if (myVote && isAnswerCorrect(q, myVote.value)) correct += 1;
    });
    return { correct, total };
  }, [session?.questions]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[62vh] text-center gap-6 px-6">
      <DoranDoranMascot size="lg" mood="happy" />
      <div className="flex items-center gap-2">
        <Medal size={24} className="text-amber-500" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">합산 랭킹 발표 중</h2>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm ring-1 ring-slate-200/70 dark:ring-slate-700 px-10 py-7">
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-1.5">나의 결과</p>
        <p className="text-slate-900 dark:text-slate-100 tabular-nums">
          <span className="text-5xl font-bold">{correct}</span>
          <span className="text-2xl font-semibold text-slate-600 dark:text-slate-400"> / {total} 정답</span>
        </p>
      </div>
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-medium">
        <Monitor size={16} />
        전자칠판에서 전체 순위를 확인하세요
      </div>
    </div>
  );
}
