import { useState, useMemo, useRef, useCallback, useLayoutEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ref, set, get, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { generateSessionId, generateQuestionId } from '@/lib/utils';
import Modal from '@/components/ui/Modal';
import CreateSessionStepCourse from './CreateSessionStepCourse';
import CreateSessionStepNewCourse from './CreateSessionStepNewCourse';
import CreateSessionStepConfirm from './CreateSessionStepConfirm';
import ModePreview from './ModePreview';
import { useCourses } from '@/features/course/api/useCourses';

export default function CreateSessionModal({ open, onClose, onCreated, sessions, adminUser }) {
  const [step, setStep] = useState('course'); // 'course' | 'new-course' | 'confirm' | 'preview'
  const stepContentRef = useRef(null);
  const previousStepRef = useRef(step);
  const focusStep = useCallback(() => {
    if (open) stepContentRef.current?.focus({ preventScroll: true });
  }, [open]);
  // The selected button disappears when a step exits. This wrapper stays
  // mounted throughout the transition, so focus cannot leave with that button.
  useLayoutEffect(() => {
    const changed = step !== previousStepRef.current;
    previousStepRef.current = step;
    // Initial focus belongs to Modal, which first records its external trigger.
    if (changed) focusStep();
  }, [step, focusStep]);
  // 어떤 모드를 미리보기 중인지. 미리보기는 세션에 붙지 않아 아무것도 저장되지 않는다.
  const [previewMode, setPreviewMode] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [newCourseName, setNewCourseName] = useState('');
  const [roundNumber, setRoundNumber] = useState(1);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  // Duplication state
  const [duplicateEnabled, setDuplicateEnabled] = useState(false);
  const [duplicateSourceId, setDuplicateSourceId] = useState('');
  // 기업 행사모드 — 켜면 입장 시 사번(직원번호) 필수
  const [requireEmployeeId, setRequireEmployeeId] = useState(false);
  // 추첨 전용 모드 — 참여자 입장 없이 강사가 명단을 직접 넣어 추첨만 한다
  const [drawOnly, setDrawOnly] = useState(false);

  const { courses: dbCourses, createCourse } = useCourses(
    adminUser?.uid, adminUser?.role
  );

  // Enrich courses with session stats (count, maxRound) for display
  const courses = useMemo(() => {
    const sessionStats = {};
    sessions.forEach((s) => {
      if (!s.courseName) return;
      if (!sessionStats[s.courseName]) sessionStats[s.courseName] = { count: 0, maxRound: 0 };
      sessionStats[s.courseName].count++;
      if (s.roundNumber > sessionStats[s.courseName].maxRound) {
        sessionStats[s.courseName].maxRound = s.roundNumber;
      }
    });
    return dbCourses.map((c) => ({
      id: c.id,
      name: c.name,
      count: sessionStats[c.name]?.count || 0,
      maxRound: sessionStats[c.name]?.maxRound || 0,
    }));
  }, [dbCourses, sessions]);

  const previousRounds = useMemo(() => {
    if (!selectedCourse) return [];
    return sessions
      .filter((s) => s.courseName === selectedCourse && s.questionCount > 0)
      .sort((a, b) => (b.roundNumber || 0) - (a.roundNumber || 0));
  }, [sessions, selectedCourse]);

  function handleSelectCourse(course) {
    setSelectedCourse(course.name);
    setSelectedCourseId(course.id);
    setRoundNumber(course.maxRound + 1);
    setDuplicateEnabled(false);
    setDuplicateSourceId('');
    setStep('confirm');
  }

  function handleNewCourse() {
    setStep('new-course');
    setNewCourseName('');
  }

  async function handleNewCourseSubmit() {
    if (!newCourseName.trim()) return;
    const name = newCourseName.trim();
    setError(null);
    try {
      const courseId = await createCourse(name, adminUser?.displayName);
      setSelectedCourse(name);
      setSelectedCourseId(courseId);
      setRoundNumber(1);
      setDuplicateEnabled(false);
      setDuplicateSourceId('');
      setStep('confirm');
    } catch {
      setError('강의 생성에 실패했습니다.');
    }
  }

  function handleReset() {
    setStep('course');
    setSelectedCourse('');
    setSelectedCourseId('');
    setNewCourseName('');
    setRoundNumber(1);
    setError(null);
    setDuplicateEnabled(false);
    setDuplicateSourceId('');
    setRequireEmployeeId(false);
    setDrawOnly(false);
    setPreviewMode(null);
  }

  // 둘은 같이 켤 수 없다 — 기업 행사모드는 "입장할 때 사번을 받는" 설정인데
  // 추첨 전용 모드에는 입장하는 사람 자체가 없다.
  function handleToggleEmployeeId() {
    setRequireEmployeeId((prev) => {
      if (!prev) setDrawOnly(false);
      return !prev;
    });
  }

  function handleToggleDrawOnly() {
    setDrawOnly((prev) => {
      if (!prev) setRequireEmployeeId(false);
      return !prev;
    });
  }

  function handleToggleDuplicate() {
    const next = !duplicateEnabled;
    setDuplicateEnabled(next);
    if (next && previousRounds.length > 0) {
      setDuplicateSourceId(previousRounds[0].id);
    } else {
      setDuplicateSourceId('');
    }
  }

  async function handleCreate() {
    try {
      setError(null);
      setCreating(true);
      const newId = generateSessionId();

      const sessionData = {
        status: 'setting',
        currentQuestion: null,
        currentMode: 'waiting',
        createdAt: serverTimestamp(),
        courseName: selectedCourse,
        courseId: selectedCourseId || null,
        creatorId: adminUser?.uid || null,
        roundNumber,
        ...(requireEmployeeId ? { requireEmployeeId: true } : {}), // 기업 행사모드 — 사번 필수
        ...(drawOnly ? { drawOnly: true } : {}), // 추첨 전용 — 명단 직접 입력
      };

      if (duplicateEnabled && duplicateSourceId) {
        const sourceSnap = await get(ref(db, `sessions/${duplicateSourceId}/questions`));
        const sourceQuestions = sourceSnap.val();

        if (sourceQuestions) {
          const newQuestions = {};
          Object.values(sourceQuestions)
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .forEach((q, i) => {
              const newQId = generateQuestionId();
              const {
                votes: _votes,
                aiGrades: _aiGrades,
                activatedAt: _activatedAt,
                revealedAt: _revealedAt,
                awardedAt: _awardedAt,
                event: _event,
                ...rest
              } = q;
              newQuestions[newQId] = { ...rest, order: i + 1 };
            });
          sessionData.questions = newQuestions;
        }
      }

      await set(ref(db, `sessions/${newId}`), sessionData);
      onCreated(newId);
      handleReset();
      onClose();
    } catch {
      setError('클래스 등록에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  }

  function handleClose() {
    handleReset();
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} className={step === 'preview' ? 'sm:max-w-lg' : ''}>
      <div ref={stepContentRef} tabIndex={-1} className="outline-none">
      <AnimatePresence mode="wait">
        {step === 'course' && (
          <CreateSessionStepCourse
            courses={courses}
            onSelectCourse={handleSelectCourse}
            onNewCourse={handleNewCourse}
          />
        )}
        {step === 'new-course' && (
          <CreateSessionStepNewCourse
            value={newCourseName}
            onChange={setNewCourseName}
            onBack={() => setStep('course')}
            onSubmit={handleNewCourseSubmit}
          />
        )}
        {step === 'confirm' && (
          <CreateSessionStepConfirm
            selectedCourse={selectedCourse}
            roundNumber={roundNumber}
            onSetRoundNumber={setRoundNumber}
            previousRounds={previousRounds}
            duplicateEnabled={duplicateEnabled}
            onToggleDuplicate={handleToggleDuplicate}
            duplicateSourceId={duplicateSourceId}
            onSetDuplicateSourceId={setDuplicateSourceId}
            requireEmployeeId={requireEmployeeId}
            onToggleEmployeeId={handleToggleEmployeeId}
            drawOnly={drawOnly}
            onToggleDrawOnly={handleToggleDrawOnly}
            onPreviewMode={(mode) => { setPreviewMode(mode); setStep('preview'); }}
            error={error}
            creating={creating}
            onBack={handleReset}
            onCreate={handleCreate}
          />
        )}
        {step === 'preview' && (
          <ModePreview mode={previewMode} onBack={() => setStep('confirm')} />
        )}
      </AnimatePresence>
      </div>
    </Modal>
  );
}
