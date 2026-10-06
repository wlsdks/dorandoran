import { useState, useMemo } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useRealtimeValue } from '@/hooks/useRealtimeValue';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronRight, Trophy } from 'lucide-react';
import { useAwards } from '@/features/assignments/api/useAwards';
import { useAssignment } from '@/features/assignments/api/useAssignments';
import { getAwardById } from '@/lib/judging/judges';
import AwardReveal from './AwardReveal';
import Button from '@/components/ui/Button';
import './AwardsStage.css';

// Ceremony order: special awards first, then rank awards (ascending drama)
const CEREMONY_ORDER = ['planning', 'creative', 'design', 'practical', 'outstanding', 'excellence', 'grand'];

/**
 * AwardsCeremony — 프레젠터/전자칠판용 시상식 연출 화면.
 * 강사가 "다음 발표" 버튼으로 순서대로 공개.
 */
export default function AwardsCeremony({ assignmentId, sessionId, readOnly = false, presenter = false }) {
  const reduced = useReducedMotion();
  const { assignment } = useAssignment(assignmentId);
  const { awards, loading } = useAwards(assignmentId);
  const [localIndex, setLocalIndex] = useState(-1);
  const [error, setError] = useState('');
  const { value: sharedState } = useRealtimeValue(sessionId ? `sessions/${sessionId}/gameState` : null, { scope: assignmentId });

  // Build ordered award list from available awards
  const orderedAwards = useMemo(() => {
    if (!awards) return [];
    return CEREMONY_ORDER
      .filter(id => awards[id])
      .map(id => ({ id, ...awards[id] }));
  }, [awards]);

  const sharedIndex = sharedState?.mode === 'awards' && sharedState.assignmentId === assignmentId ? sharedState.revealIndex : -1;
  const candidateIndex = sessionId ? sharedIndex : localIndex;
  const revealIndex = Number.isInteger(candidateIndex) ? Math.min(Math.max(candidateIndex, -1), orderedAwards.length - 1) : -1;
  const isStarted = revealIndex >= 0;
  const isComplete = revealIndex >= orderedAwards.length - 1;
  const currentAward = isStarted ? orderedAwards[revealIndex] : null;

  async function setCeremonyIndex(index) {
    if (readOnly) return;
    setError('');
    if (!sessionId) { setLocalIndex(index); return; }
    try {
      await update(ref(db, `sessions/${sessionId}`), { gameState: { mode: 'awards', assignmentId, revealIndex: index } });
    } catch { setError('화면에 전달하지 못했어요. 다시 시도해주세요.'); }
  }

  function handleNext() {
    if (revealIndex < orderedAwards.length - 1) return setCeremonyIndex(revealIndex + 1);
  }

  function handleReset() { return setCeremonyIndex(-1); }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-slate-400">불러오는 중...</p>
      </div>
    );
  }

  if (!awards || orderedAwards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <DoranDoranMascot size={160} mood="waiting" />
        <p className="text-slate-900 dark:text-slate-100 text-3xl font-semibold">{readOnly ? '마무리를 준비하고 있어요' : '아직 수상 결과가 없습니다'}</p>
        <p className="text-slate-600 dark:text-slate-300 text-2xl">{readOnly ? '잠시 후 함께 축하해요' : '수상 결과를 준비한 뒤 시상식을 시작하세요'}</p>
      </div>
    );
  }

  return (
    <div data-presenter={presenter} className="awards-stage flex flex-col items-center gap-8 w-full max-w-2xl mx-auto py-8" onClick={e => e.stopPropagation()}>
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: reduced ? 0 : -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <Trophy size={28} className="mx-auto text-slate-500 dark:text-white/60" />
        <h2 className="awards-stage-title text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">시상식</h2>
        {assignment && (
          <p className="awards-stage-subtitle text-slate-600 dark:text-slate-400 text-sm">{assignment.title}</p>
        )}
      </motion.div>

      {error && <p role="alert" className="text-red-300 text-base">{error}</p>}
      {/* Current reveal */}
      <div className="awards-stage-reveal min-h-[250px] flex items-center justify-center w-full">
        <AnimatePresence mode="wait">
          {!isStarted ? (
            <motion.div
              key="start"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-4"
            >
              <p className="awards-stage-pending text-slate-600 dark:text-slate-300 text-lg">{orderedAwards.length}개 수상 발표 예정</p>
              {!readOnly && (
                <Button onClick={handleNext} variant="secondary" size="lg">
                  시상 시작 <ChevronRight size={18} />
                </Button>
              )}
            </motion.div>
          ) : (
            <motion.div
              key={`award-${revealIndex}`}
              className="w-full min-w-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <AwardReveal
                awardId={currentAward.id}
                winner={currentAward}
                revealed={true}
                presenter={presenter}
                showJudge={assignment?.hasJudging === true}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      {isStarted && !readOnly && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-3"
        >
          {!isComplete ? (
            <Button onClick={handleNext} variant="secondary" size="lg">
              다음 발표 <ChevronRight size={18} />
            </Button>
          ) : (
            <Button onClick={handleReset} variant="secondary" size="lg">
              처음부터
            </Button>
          )}
        </motion.div>
      )}

      {/* Progress + revealed list */}
      {isStarted && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full space-y-3"
        >
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2">
            {orderedAwards.map((a, i) => {
              return (
                <motion.div
                  key={a.id}
                  animate={{
                    scale: !reduced && i === revealIndex ? 1.3 : 1,
                    opacity: i <= revealIndex ? 1 : 0.3,
                  }}
                  className={`w-2.5 h-2.5 rounded-full ${i <= revealIndex ? 'bg-slate-900 dark:bg-white' : 'bg-slate-300 dark:bg-white/20'}`}
                />
              );
            })}
          </div>

          {/* Previously announced */}
          {revealIndex > 0 && (
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {orderedAwards.slice(0, revealIndex).map((a) => {
                const info = getAwardById(a.id);
                return (
                  <span key={a.id} className="awards-stage-previous inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-white/5 rounded-full text-xs text-slate-600 dark:text-slate-400">
                    {info?.name}: <span className="text-slate-900 dark:text-slate-200 font-medium">{a.name}</span>
                  </span>
                );
              })}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
