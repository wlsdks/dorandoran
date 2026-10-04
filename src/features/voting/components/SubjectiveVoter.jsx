import { useAIAvailability } from '@/hooks/useAIAvailability';
import { Star } from 'lucide-react';
import { useState, useEffect, memo } from 'react';
import { ref, onValue } from 'firebase/database';
import { motion } from 'framer-motion';
import { db } from '@/lib/firebase';
import { getParticipantId } from '@/lib/participant';
import TextInput from './TextInput';

// 하우스 스타일(AnswerRevealCard 준거): 긍정=emerald, 나머지=slate. 신호등 색상 미사용.
function scoreColor(score) {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  return 'text-slate-700 dark:text-slate-200';
}
function GradeCard({
  grade
}) {
  return <motion.div initial={{
    opacity: 0,
    y: 12
  }} animate={{
    opacity: 1,
    y: 0
  }} transition={{
    type: 'spring',
    stiffness: 300,
    damping: 25
  }} className="w-full rounded-xl bg-white dark:bg-slate-800 px-5 py-8 shadow-sm">
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm font-medium text-slate-400">AI 채점 결과</p>
        <motion.div initial={{
        scale: 0
      }} animate={{
        scale: 1
      }} transition={{
        type: 'spring',
        stiffness: 300,
        damping: 20,
        delay: 0.1
      }} className="flex items-baseline gap-1">
          <span className={`text-5xl font-bold tracking-tight ${scoreColor(grade.score)}`}>{grade.score}</span>
          <span className="text-xl font-semibold text-slate-300 dark:text-slate-600">/ 100</span>
        </motion.div>
        {grade.feedback && <motion.div initial={{
        opacity: 0,
        y: 8
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        delay: 0.3
      }} className="rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-700 dark:border-slate-600 px-4 py-3 text-center w-full">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-relaxed">{grade.feedback}</p>
          </motion.div>}
      </div>
    </motion.div>;
}
export default memo(function SubjectiveVoter({
  sessionId,
  questionId,
  disabled
}) {
  const {
    available
  } = useAIAvailability();
  const [grade, setGrade] = useState(null);
  useEffect(() => {
    if (!sessionId || !questionId) return;
    const pid = getParticipantId();
    const gradeRef = ref(db, `sessions/${sessionId}/questions/${questionId}/aiGrades/${pid}`);
    const unsub = onValue(gradeRef, snap => setGrade(snap.val()));
    return () => unsub();
  }, [sessionId, questionId]);

  // 내 답변이 스포트라이트로 선정됐는지 — 전자칠판의 답변 소개 안내
  const [spotlit, setSpotlit] = useState(false);
  useEffect(() => {
    if (!sessionId || !questionId) return;
    const pid = getParticipantId();
    const unsub = onValue(ref(db, `sessions/${sessionId}/questions/${questionId}/spotlight`), snap => {
      setSpotlit(snap.val()?.pid === pid);
    });
    return () => unsub();
  }, [sessionId, questionId]);
  const spotBanner = spotlit && <motion.div initial={{
    opacity: 0,
    y: 8,
    scale: 0.97
  }} animate={{
    opacity: 1,
    y: 0,
    scale: 1
  }} transition={{
    type: 'spring',
    stiffness: 300,
    damping: 24
  }} className="w-full rounded-xl bg-amber-50 dark:bg-amber-400/10 ring-1 ring-amber-400/60 px-4 py-3.5 flex items-center gap-3">
      <span className="w-9 h-9 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center shrink-0"><Star size={17} fill="currentColor" /></span>
      <span className="text-sm font-semibold text-amber-700 dark:text-amber-300 leading-snug">
        내 답변이 전자칠판에 소개되고 있어요!  🎉
      </span>
    </motion.div>;
  if (available && grade && typeof grade.score === 'number') return <div className="space-y-3">{spotBanner}<GradeCard grade={grade} /></div>;
  return <div className="space-y-3">
    {spotBanner}
    <TextInput sessionId={sessionId} questionId={questionId} type="subjective" placeholder="답변을 자유롭게 작성해주세요" maxLength={500} multiline disabled={disabled} />
    </div>;
});
